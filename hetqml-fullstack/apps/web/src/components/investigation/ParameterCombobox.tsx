"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  allowedValuesForField,
  isCascadeFieldUnlocked,
  isOptionGuidedInCascade,
  type FieldName,
  type Selection,
} from "@/lib/investigation/recommendations";

export interface ComboOption {
  name: string;
  meta: { id: string; category: string };
}

interface Props {
  field: FieldName;
  label: string;
  hint?: string;
  placeholder: string;
  lockedPlaceholder?: string;
  options: readonly ComboOption[];
  value: string;
  selection: Selection;
  onChange: (next: string) => void;
  /** When false, field waits for upstream CASCADE_ORDER fields (disease → … → metaedge). */
  enforceCascadeOrder?: boolean;
}

type GuideMode = "guided" | "all";

export function ParameterCombobox({
  field,
  label,
  hint,
  placeholder,
  lockedPlaceholder,
  options,
  value,
  selection,
  onChange,
  enforceCascadeOrder = true,
}: Props) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GuideMode>("guided");
  const [catPill, setCatPill] = useState<string>("all");

  const cascadeLocked =
    enforceCascadeOrder && !isCascadeFieldUnlocked(field, selection);

  const allowed = useMemo(
    () => allowedValuesForField(field, selection),
    [field, selection],
  );

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const o of options) s.add(o.meta.category);
    return ["all", ...Array.from(s).sort()];
  }, [options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      if (q && !opt.name.toLowerCase().includes(q)) return false;
      if (catPill !== "all" && opt.meta.category !== catPill) return false;
      if (mode === "guided") {
        if (field === "disease") {
          return isOptionGuidedInCascade(field, opt.name, selection);
        }
        if (allowed !== null) {
          return isOptionGuidedInCascade(field, opt.name, selection);
        }
      }
      return true;
    });
  }, [options, query, mode, field, selection, catPill, allowed]);

  const meta = useMemo(
    () => options.find((opt) => opt.name === value)?.meta ?? null,
    [options, value],
  );

  const handlePick = (next: string) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

  const diseaseStyleCategories = categories.length > 4;

  const ph = cascadeLocked
    ? (lockedPlaceholder ?? placeholder)
    : placeholder;

  const openCombo = () => {
    if (cascadeLocked) return;
    setOpen(true);
    setQuery("");
  };

  useEffect(() => {
    if (cascadeLocked) setOpen(false);
  }, [cascadeLocked]);

  useEffect(() => {
    if (!open || cascadeLocked) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setOpen(false);
    };
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocMouseDown, true);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDocMouseDown, true);
    };
  }, [open, cascadeLocked]);

  return (
    <div>
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div
        ref={rootRef}
        className={`combo${open ? " open" : ""}${cascadeLocked ? " combo-cascade-locked" : ""}`}
        tabIndex={-1}
        role="presentation"
      >
        <div
          className="combo-input-wrap"
          onMouseDown={(e) => {
            if (cascadeLocked) return;
            if ((e.target as HTMLElement).closest(".combo-list")) return;
            openCombo();
          }}
        >
          <input
            id={inputId}
            className="combo-input"
            type="text"
            autoComplete="off"
            placeholder={ph}
            disabled={cascadeLocked}
            value={open ? query : value}
            onFocus={() => {
              openCombo();
            }}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="combo-chev">▼</span>
        </div>
        {!open && meta ? (
          <div className="combo-meta">
            <span className="id">{meta.id}</span>
            <span className="cat">{meta.category}</span>
          </div>
        ) : null}
        {open && !cascadeLocked ? (
          <div className="combo-list" role="listbox">
            <div className="combo-cat-filter">
              <span
                className={`combo-cat-pill${mode === "guided" ? " active" : ""}`}
                role="button"
                tabIndex={0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode("guided")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setMode("guided");
                }}
              >
                guided
              </span>
              <span
                className={`combo-cat-pill${mode === "all" ? " active" : ""}`}
                role="button"
                tabIndex={0}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMode("all")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setMode("all");
                }}
              >
                all
              </span>
            </div>
            {diseaseStyleCategories ? (
              <div className="combo-cat-filter">
                {categories.map((c) => (
                  <span
                    key={c}
                    className={`combo-cat-pill${catPill === c ? " active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setCatPill(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setCatPill(c);
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="combo-list-head">
              {filtered.length} of {options.length}{" "}
              <span className="count">(catalog)</span>
            </div>
            {filtered.length === 0 ? (
              <div className="combo-empty">
                No matches. Try <strong>all</strong> mode or another category.
              </div>
            ) : (
              filtered.map((opt) => {
                const guided =
                  mode === "guided" &&
                  isOptionGuidedInCascade(field, opt.name, selection);
                return (
                  <div
                    key={opt.name}
                    role="option"
                    aria-selected={opt.name === value}
                    className={`combo-option${guided ? " highlighted" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(opt.name);
                    }}
                  >
                    <div className="combo-option-name">{opt.name}</div>
                    <div className="combo-option-meta">
                      <span className="id">{opt.meta.id}</span>
                      <span className="cat">{opt.meta.category}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>
      {hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}
