"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { isLiteMode, LITE_BADGE_LABEL } from "@/lib/liteMode";

import { DashboardModeToggle } from "./DashboardModeToggle";

const APP_VER = "v0.7.2";

const WORKFLOW = [
  { href: "/initialize", num: "01", title: "Initialize", sub: "Define investigation" },
  { href: "/experiment", num: "02", title: "Experiment", sub: "Produce evidence" },
  { href: "/validate", num: "03", title: "Validate", sub: "Trust the result" },
  { href: "/visualize", num: "04", title: "Visualize", sub: "Inspect visually" },
] as const;

const SYSTEM = [
  { href: "/operations", icon: "▢", title: "Operations" },
  { href: "/settings", icon: "⚙", title: "Settings" },
] as const;

function navClass(active: string, href: string) {
  return `nav-item${active === href ? " active" : ""}`;
}

interface SidebarProps {
  active: string;
}

export function Sidebar({ active }: SidebarProps) {
  // Owns the collapse state so AppShell can stay a server component.
  // Toggle flips a body class — the export CSS already handles the rest.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    return () => {
      document.body.classList.remove("sidebar-collapsed");
    };
  }, [collapsed]);

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar-toggle"
        title="Collapse sidebar"
        aria-label="Toggle sidebar"
        onClick={() => setCollapsed((c) => !c)}
      >
        ‹
      </button>
      <div className="brand">
        <div className="brand-icon">◎</div>
        <div>
          <div className="brand-name">Hetionet · QML</div>
          <div className="brand-ver">{APP_VER}</div>
        </div>
      </div>
      <div className="section-label">Workflow</div>
      {WORKFLOW.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={navClass(active, item.href)}
        >
          <span className="nav-num">{item.num}</span>
          <div className="nav-text">
            <div className="nav-title">{item.title}</div>
            <div className="nav-sub">{item.sub}</div>
          </div>
        </Link>
      ))}
      <div className="section-label">System</div>
      {SYSTEM.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={navClass(active, item.href)}
        >
          <span className="nav-icon">{item.icon}</span>
          <div className="nav-text">
            <div className="nav-title">{item.title}</div>
          </div>
        </Link>
      ))}
      <DashboardModeToggle />
      {isLiteMode() ? <LiteBadge /> : <FullModeStatus />}
    </aside>
  );
}

function LiteBadge() {
  return (
    <div
      className="status-bar"
      style={{ borderTop: "1px solid var(--gold, #C8A45A)" }}
    >
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--gold, #C8A45A)",
          marginRight: 6,
        }}
        aria-hidden="true"
      />
      <span
        className="mono"
        style={{ color: "var(--gold, #C8A45A)", fontWeight: 600 }}
      >
        {LITE_BADGE_LABEL}
      </span>
      <div
        style={{
          color: "var(--faint)",
          fontSize: 10,
          marginTop: 4,
          lineHeight: 1.4,
        }}
      >
        Static build · no backend · mock data only
      </div>
    </div>
  );
}

function FullModeStatus() {
  return (
    <div className="status-bar">
      <span className="status-dot" />
      <span className="mono">ibm_torino</span>
      <div
        style={{
          color: "var(--faint)",
          fontSize: 10,
          marginTop: 4,
        }}
      >
        queue: 2 · last verified (local dev)
      </div>
    </div>
  );
}
