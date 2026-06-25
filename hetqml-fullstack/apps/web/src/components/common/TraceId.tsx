"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api/client";

/** Small inline panel that surfaces the request id from an `ApiError` so
 * a user can copy it into a support ticket.
 *
 * Renders `null` when the error isn't an `ApiError`, or when the id is
 * missing (e.g. the request never reached the API — CORS preflight
 * failure, network drop, or the legacy plain-`Error` path that was
 * carried over from the pre-`ApiError` code).
 *
 * The "Copy" button uses the Clipboard API and falls back to a
 * `select-and-copy` selection when the API is unavailable (e.g. lite
 * builds without HTTPS). The copy state is purely local — it never
 * re-renders the parent.
 */
export function TraceId({ err }: { err: unknown }) {
  const requestId = err instanceof ApiError ? err.requestId : null;
  const [copied, setCopied] = useState(false);

  if (!requestId) return null;

  const onCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(requestId);
      } else {
        const range = document.createRange();
        const el = document.getElementById(`trace-${requestId}`);
        if (el) {
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
          document.execCommand("copy");
          sel?.removeAllRanges();
        }
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard access blocked — leave the id in place, user can
       * still triple-click to select + copy */
    }
  };

  return (
    <div
      className="trace-id"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 6,
        fontSize: 11,
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        color: "var(--muted)",
      }}
    >
      <span style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Trace
      </span>
      <code
        id={`trace-${requestId}`}
        style={{
          padding: "2px 6px",
          background: "var(--paper-alt)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          color: "var(--ink)",
          userSelect: "all",
        }}
        title="Request id — paste into support tickets so we can grep logs end-to-end"
      >
        {requestId}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="btn-mini"
        style={{
          fontSize: 10,
          padding: "2px 8px",
          background: "transparent",
          color: "var(--teal)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          cursor: "pointer",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
        aria-label="Copy trace id to clipboard"
      >
        {copied ? "✓ copied" : "copy"}
      </button>
    </div>
  );
}
