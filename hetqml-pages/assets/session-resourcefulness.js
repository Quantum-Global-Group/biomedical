const SESSIONS_KEY = "hetqml.sessions";
const RESOURCE_KEY = "hetqml.session-resourcefulness";

const COMPARE_FIELDS = ["compound", "disease", "gene", "metaedge", "runPath"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function sessionTime(session) {
  return Number(session.updatedAt ?? session.savedAt ?? session.createdAt ?? session.ts ?? 0);
}

export function enrichSession(session, metadata = {}) {
  const tags = parseTags(metadata.tags ?? session.tags);
  const notes = String(metadata.notes ?? session.notes ?? "").trim();

  return {
    ...session,
    label: session.name ?? `${session.compound ?? "Candidate"} -> ${session.disease ?? "Disease"}`,
    notes,
    tags,
    reviewer: metadata.reviewer ?? session.reviewer ?? "unassigned",
  };
}

export function compareSessions(left, right) {
  if (!left || !right) {
    return [];
  }

  return COMPARE_FIELDS
    .filter((field) => String(left[field] ?? "") !== String(right[field] ?? ""))
    .map((field) => ({
      field,
      before: left[field] ?? "not set",
      after: right[field] ?? "not set",
    }));
}

export function getSmartResumeSuggestion(sessions) {
  const enriched = sessions.map((session) => enrichSession(session));
  if (enriched.length === 0) {
    return {
      session: null,
      reason: "No saved sessions yet. Save a snapshot to make resume suggestions useful.",
    };
  }

  const ranked = [...enriched].sort((a, b) => {
    const aScore = sessionTime(a) + (a.notes ? 30_000 : 0) + (a.tags.length * 10_000);
    const bScore = sessionTime(b) + (b.notes ? 30_000 : 0) + (b.tags.length * 10_000);
    return bScore - aScore;
  });

  return {
    session: ranked[0],
    reason: ranked[0].notes
      ? "Most recent session with notes, so it is likely ready to resume."
      : "Most recent saved investigation.",
  };
}

function readJson(windowRef, key, fallback) {
  try {
    return JSON.parse(windowRef.localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(windowRef, key, value) {
  try {
    windowRef.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Static export enhancement: localStorage may be unavailable in hardened contexts.
  }
}

function normalizeSessions(rawSessions) {
  if (Array.isArray(rawSessions)) {
    return rawSessions;
  }

  if (rawSessions && typeof rawSessions === "object") {
    return Object.values(rawSessions);
  }

  return [];
}

function renderChange(change) {
  return `<div class="session-change">
    <span>${escapeHtml(change.field)}</span>
    <strong>${escapeHtml(change.before)} -> ${escapeHtml(change.after)}</strong>
  </div>`;
}

function renderSessionOption(session, index) {
  return `<option value="${index}">${escapeHtml(enrichSession(session).label)}</option>`;
}

export function renderSessionResourcefulness(sessions, metadata = {}) {
  const enriched = sessions.map((session) => enrichSession(session, metadata[session.id] ?? {}));
  const suggestion = getSmartResumeSuggestion(enriched);
  const latest = enriched[0];
  const compareTarget = enriched[1] ?? enriched[0];
  const changes = compareSessions(compareTarget, latest);

  return `<section class="session-resourcefulness" data-session-resourcefulness>
    <div class="session-resource-head">
      <div>
        <div class="eyebrow">SESSION TOOLS</div>
        <div class="panel-title">More resourceful save and resume</div>
      </div>
      <span class="session-count">${enriched.length} saved</span>
    </div>
    <div class="session-tool-grid">
      <div class="session-tool-card">
        <div class="metric-label">Smart resume</div>
        <strong>${suggestion.session ? escapeHtml(suggestion.session.label) : "Nothing saved yet"}</strong>
        <p>${escapeHtml(suggestion.reason)}</p>
      </div>
      <div class="session-tool-card">
        <div class="metric-label">Organize</div>
        <label>Notes<input data-session-notes placeholder="Why save this?" value="${escapeHtml(latest?.notes ?? "")}"></label>
        <label>Tags<input data-session-tags placeholder="renal, review, quantum" value="${escapeHtml((latest?.tags ?? []).join(", "))}"></label>
      </div>
      <div class="session-tool-card">
        <div class="metric-label">Compare</div>
        <select data-session-compare-a>${enriched.map(renderSessionOption).join("")}</select>
        <select data-session-compare-b>${enriched.map(renderSessionOption).join("")}</select>
        <div class="session-change-list">${changes.length ? changes.map(renderChange).join("") : "<em>No differences between selected saved investigations.</em>"}</div>
      </div>
    </div>
  </section>`;
}

function styles() {
  return `.session-resourcefulness{margin-top:16px;padding:16px;border:1px solid var(--border-soft);border-radius:6px;background:rgba(255,255,255,.025)}
.session-resource-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.session-count{border:1px solid var(--teal);background:var(--teal-bg);color:var(--teal);border-radius:999px;padding:6px 9px;font-size:11px;font-weight:700}
.session-tool-grid{display:grid;grid-template-columns:1fr 1.2fr 1.2fr;gap:12px;margin-top:14px}
.session-tool-card{border:1px solid var(--border-soft);border-radius:5px;padding:12px;background:rgba(0,0,0,.12)}
.session-tool-card strong{display:block;color:var(--ink);font-size:13px;margin-top:6px}
.session-tool-card p{margin:8px 0 0;color:var(--muted);font-size:12px;line-height:1.5}
.session-tool-card label{display:block;color:var(--faint);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-top:8px}
.session-tool-card input,.session-tool-card select{box-sizing:border-box;width:100%;margin-top:5px;border:1px solid var(--border-soft);border-radius:4px;background:rgba(0,0,0,.2);color:var(--ink);padding:8px;font-size:12px}
.session-change-list{margin-top:8px}
.session-change{border-top:1px solid var(--border-soft);padding:7px 0;font-size:12px}
.session-change span{display:block;color:var(--faint);text-transform:uppercase;letter-spacing:.08em;font-size:10px}
.session-change strong{color:var(--muted)}
.session-change-list em{display:block;color:var(--faint);font-size:12px;line-height:1.5;margin-top:8px}
@media (max-width:900px){.session-tool-grid{grid-template-columns:1fr}.session-resource-head{display:block}.session-count{display:inline-block;margin-top:10px}}`;
}

function injectStyles(documentRef) {
  if (documentRef.getElementById("session-resourcefulness-styles")) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = "session-resourcefulness-styles";
  style.textContent = styles();
  documentRef.head.appendChild(style);
}

function findSessionPanel(documentRef) {
  return Array.from(documentRef.querySelectorAll(".panel")).find((panel) => {
    const eyebrow = panel.querySelector(".eyebrow");
    return eyebrow?.textContent?.trim() === "TOOL · SESSION";
  });
}

function readSessions(windowRef) {
  const stored = normalizeSessions(readJson(windowRef, SESSIONS_KEY, []));

  if (stored.length > 0) {
    return stored;
  }

  return [{
    id: "current",
    name: "Current investigation",
    compound: "Inaxaplin",
    compoundId: "DB12015",
    disease: "Hypertension-attributed ESKD",
    gene: "APOL1",
    metaedge: "CtD",
    runPath: "hybrid",
    reviewer: "local reviewer",
    updatedAt: Date.now(),
  }];
}

function rerender(panel, windowRef) {
  const sessions = readSessions(windowRef);
  const metadata = readJson(windowRef, RESOURCE_KEY, {});
  const wrapper = panel.ownerDocument.createElement("div");
  wrapper.innerHTML = renderSessionResourcefulness(sessions, metadata);

  const existing = panel.querySelector("[data-session-resourcefulness]");
  if (existing) {
    existing.replaceWith(wrapper.firstElementChild);
  } else {
    panel.appendChild(wrapper.firstElementChild);
  }
}

export function mountSessionResourcefulness(documentRef = globalThis.document, windowRef = globalThis.window) {
  if (!documentRef || !windowRef) {
    return false;
  }

  const panel = findSessionPanel(documentRef);
  if (!panel) {
    return false;
  }

  injectStyles(documentRef);
  rerender(panel, windowRef);

  const mounted = panel.querySelector("[data-session-resourcefulness]");
  if (mounted && !mounted.dataset.bound) {
    mounted.dataset.bound = "true";
    mounted.addEventListener("input", () => {
      const sessions = readSessions(windowRef);
      const first = sessions[0];
      if (!first?.id) {
        return;
      }
      const metadata = readJson(windowRef, RESOURCE_KEY, {});
      metadata[first.id] = {
        notes: mounted.querySelector("[data-session-notes]")?.value ?? "",
        tags: mounted.querySelector("[data-session-tags]")?.value ?? "",
      };
      writeJson(windowRef, RESOURCE_KEY, metadata);
    });
  }

  return true;
}

if (typeof window !== "undefined") {
  const mount = () => mountSessionResourcefulness(window.document, window);

  const scheduleInitialMount = () => {
    window.setTimeout(mount, 1200);
    window.setTimeout(mount, 2500);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleInitialMount, { once: true });
  } else {
    scheduleInitialMount();
  }

  window.addEventListener("load", scheduleInitialMount, { once: true });
}
