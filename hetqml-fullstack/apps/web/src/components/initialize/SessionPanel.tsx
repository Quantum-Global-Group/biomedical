"use client";

import { useCallback, useEffect, useState } from "react";
import type { Selection } from "@/lib/investigation/recommendations";
import type { RunPathChoice } from "@/lib/investigation/runPath";
import { getRunPathSelection } from "@/lib/investigation/runPath";
import {
  SESSIONS_KEY,
  appendSession,
  clearAllSessions,
  loadSessions,
  removeSession,
  type StoredSession,
} from "@/lib/sessions/storage";
import { COMPOUNDS } from "@/lib/data/compounds";

interface Props {
  selection: Selection;
  runPath: RunPathChoice;
  onRestore: (snapshot: Pick<StoredSession, "selection" | "runPath">) => void;
}

export function SessionPanel({ selection, runPath, onRestore }: Props) {
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [filter, setFilter] = useState("");

  const refresh = useCallback(() => setSessions(loadSessions()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSIONS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const path = getRunPathSelection(runPath).family.id;
  const allFilled = Object.values(selection).every((v) => v.length > 0);

  const filtered = sessions.filter((s) =>
    s.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">TOOL · SESSION</div>
          <div className="panel-title">Save or resume</div>
        </div>
        <span className="badge">Action</span>
      </div>
      <p className="panel-purpose">
        Investigations are reusable artifacts. Save a snapshot of the four
        parameters + run path, then restore it later. State persists in the
        browser via localStorage. Snapshots are not the same as completed job
        links — after a run finishes, use the handoff buttons or{" "}
        <code>?jobId=</code> on Experiment to reopen a specific result.
      </p>

      <div className="current-state" id="current-state">
        <div className="current-state-h">
          CURRENT INVESTIGATION (UNSAVED)
        </div>
        <div className="current-state-line">
          <span className="v">{selection.compound || "—"}</span>{" "}
          <span className="id">
            {COMPOUNDS.find((c) => c.name === selection.compound)?.drugbank ??
              "—"}
          </span>
          {" → "}
          <span className="v">{selection.disease || "—"}</span>
        </div>
        <div className="current-state-line" style={{ marginTop: 4 }}>
          {selection.metaedge ? (
            <span className="pill">{selection.metaedge.slice(0, 3)}</span>
          ) : (
            <span className="pill">metaedge</span>
          )}
          {selection.gene ? (
            <span className="pill">anchor: {selection.gene}</span>
          ) : null}
          <span className="pill path">{path}</span>
        </div>
      </div>

      <div className="session-actions-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary"
          style={{ flex: 1, justifyContent: "center" }}
          disabled={!allFilled}
          onClick={() => {
            const name =
              selection.compound && selection.disease
                ? `${selection.compound} → ${selection.disease}`
                : `Session ${new Date().toLocaleString()}`;
            appendSession(name, selection, runPath);
            refresh();
          }}
        >
          ▢ Save snapshot
        </button>
        <button
          type="button"
          className="btn"
          title="Resume most recent session"
          disabled={sessions.length === 0}
          onClick={() => {
            const latest = loadSessions()[0];
            if (latest) onRestore(latest);
          }}
        >
          ↻ Quick resume
        </button>
      </div>

      <div className="session-search-row">
        <input
          type="text"
          className="input session-search"
          placeholder="Filter saved sessions..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          style={{ color: "var(--sienna)" }}
          onClick={() => {
            clearAllSessions();
            refresh();
          }}
        >
          Clear all
        </button>
      </div>

      <div className="session-list-head">
        <span className="section-label" style={{ margin: 0 }}>
          RECENT ({filtered.length})
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="session-empty">
          No saved sessions yet. Tap &quot;Save snapshot&quot; to start a
          history.
        </p>
      ) : (
        <div className="session-list">
          {filtered.map((s) => (
            <div key={s.id} className="session-card">
              <div className="session-card-head">
                <div className="session-name">{s.name}</div>
                <div className="session-time">
                  {new Date(s.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="session-card-foot">
                <span className="session-reviewer">local</span>
                <div className="session-actions-inline">
                  <button
                    type="button"
                    className="session-btn primary"
                    onClick={() => onRestore(s)}
                  >
                    load
                  </button>
                  <button
                    type="button"
                    className="session-btn danger"
                    onClick={() => {
                      removeSession(s.id);
                      refresh();
                    }}
                  >
                    delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel-footer">
        <span>localStorage://{SESSIONS_KEY}</span>
        <span>
          <em>persisted locally</em>
        </span>
      </div>
    </section>
  );
}
