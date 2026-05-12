"""Cross-cutting observability primitives (request IDs, log filters).

Lives outside the ``routers/`` package so middleware can import from here
without circular dependencies on routers that may later want to log with
the current request id in scope.
"""

from hetqml_api.observability.request_id import (
    REQUEST_ID_HEADER,
    RequestIdFilter,
    RequestIdMiddleware,
    current_request_id,
    new_request_id,
    request_id_ctx,
)

__all__ = [
    "REQUEST_ID_HEADER",
    "RequestIdFilter",
    "RequestIdMiddleware",
    "current_request_id",
    "new_request_id",
    "request_id_ctx",
]
