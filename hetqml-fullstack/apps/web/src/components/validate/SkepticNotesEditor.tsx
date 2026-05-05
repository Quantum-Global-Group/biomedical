"use client";

import type { NoteState } from "@/lib/validate/useValidate";

interface Props {
  pairKey: string;
  body: string;
  state: NoteState;
  loaded: boolean;
  savedAt: Date | null;
  error: string | null;
  onChange: (body: string) => void;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Per-pair freeform notes editor with debounced server-side autosave.
 *  Saves go to PUT /notes/{pairKey}; on failure, the body is queued in
 *  localStorage and the pill flips to "offline · queued". */
export function SkepticNotesEditor({
  pairKey,
  body,
  state,
  loaded,
  savedAt,
  error,
  onChange,
}: Props) {
  const charCount = body.length;
  const pillLabel = (() => {
    switch (state) {
      case "saving":
        return "saving…";
      case "saved":
        return savedAt ? `✓ saved · ${formatTime(savedAt)}` : "✓ saved";
      case "dirty":
        return "typing…";
      case "offline":
        return "offline · queued locally";
      case "idle":
      default:
        return loaded ? "no changes" : "loading…";
    }
  })();
  const pillColor =
    state === "saved"
      ? "var(--green)"
      : state === "offline"
        ? "var(--sienna)"
        : "var(--faint)";

  return (
    <div>
      <textarea
        className="skeptic-textarea"
        placeholder="Write your counter-argument here. What evidence would persuade you to flip your decision? Autosaves as you type."
        value={body}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 10,
          background: "var(--paper-alt)",
          border: "1px solid var(--border-soft)",
          color: "var(--ink)",
          fontFamily: "monospace",
          fontSize: 12,
          borderRadius: 3,
          resize: "vertical",
          minHeight: 84,
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 10,
          color: "var(--faint)",
          fontFamily: "monospace",
        }}
      >
        <span>{charCount} chars</span>
        <span style={{ color: pillColor }}>{pillLabel}</span>
      </div>
      <div className="panel-footer" style={{ marginTop: 8 }}>
        <span className="mono">PUT /notes/{pairKey}</span>
        <span>
          <em>{error ? error : `pair · ${pairKey}`}</em>
        </span>
      </div>
    </div>
  );
}
