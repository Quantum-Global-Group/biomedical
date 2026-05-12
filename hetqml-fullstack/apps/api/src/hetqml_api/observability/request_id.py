"""Request-id middleware + log filter.

Every inbound request gets a stable `X-Request-ID`:

  * If the client supplied one (sanitized to ASCII alphanumerics + `-` and
    capped at 64 chars), we honor it.
  * Otherwise we mint a UUID4 hex.

The id is stashed in a ``contextvars.ContextVar`` so log records, downstream
``asyncio.to_thread`` workers, and per-job runner logs can attach it
automatically. It is echoed back on the response so the browser console and
support tooling can quote the same value the API logs use.

Operators can use this id to grep `journalctl` / Fly logs / Sentry events to
reconstruct the full path of a single user action.
"""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"

# Default value when no request has been entered (e.g. background tasks).
_REQUEST_ID_DEFAULT = "-"

request_id_ctx: ContextVar[str] = ContextVar("request_id", default=_REQUEST_ID_DEFAULT)

# Inbound ids are sanitized: keep ASCII letters, digits, hyphen, underscore,
# colon (lets Datadog/Sentry-style ids pass through) — strip anything else.
_SAFE_ID_RE = re.compile(r"[^A-Za-z0-9_\-:]")
_MAX_INBOUND_ID_LEN = 64


def new_request_id() -> str:
    """Mint a fresh request id. UUID4 hex (32 chars) — collision-free across
    instances even without coordination."""
    return uuid.uuid4().hex


def current_request_id() -> str:
    """Return the request id bound to the current async context, or ``"-"``
    when called outside a request (e.g. CLI scripts, scheduled tasks)."""
    return request_id_ctx.get()


def _sanitize_inbound(raw: str) -> str:
    cleaned = _SAFE_ID_RE.sub("", raw)[:_MAX_INBOUND_ID_LEN]
    return cleaned or new_request_id()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """ASGI middleware that binds a request id to the async context.

    Reads/sanitizes the inbound ``X-Request-ID`` header, falls back to a
    minted UUID4, runs the inner stack with the id bound, and echoes the id
    on the response (regardless of which inner handler ran).
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        inbound = request.headers.get(REQUEST_ID_HEADER)
        request_id = _sanitize_inbound(inbound) if inbound else new_request_id()
        token = request_id_ctx.set(request_id)
        try:
            response: Response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        # Echo on the way out so the browser sees what we logged. Use header
        # mutation (not a new Response) so streaming responses still work.
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


class RequestIdFilter(logging.Filter):
    """Stamp ``record.request_id`` on every log record.

    Wire into a formatter with ``%(request_id)s`` so each log line carries
    the correlating id. Records emitted outside a request get ``"-"``.
    """

    def filter(self, record: logging.LogRecord) -> bool:  # type: ignore[override]
        record.request_id = current_request_id()
        return True
