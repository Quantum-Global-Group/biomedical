"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  APP_RELEASE,
  productBrandName,
  productTagline,
} from "@/lib/branding";
import { isLiteMode, isLiteStaticDemo, LITE_BADGE_LABEL } from "@/lib/liteMode";

import { DashboardModeToggle } from "./DashboardModeToggle";
import { LiteThemeToggle } from "./LiteThemeToggle";
import { AppThemeToggle } from "./AppThemeToggle";

/** Sidebar Demo/Headline switch — off until we surface it in UX again. */
const SHOW_DASHBOARD_MODE_IN_SIDEBAR = false;

const WORKFLOW = [
  {
    href: "/initialize",
    num: "01",
    title: "Initialize",
    sub: "Protocol & cohort definition",
  },
  {
    href: "/experiment",
    num: "02",
    title: "Experiment",
    sub: "Evidence generation",
  },
  {
    href: "/validate",
    num: "03",
    title: "Validate",
    sub: "Reproducibility & trust",
  },
  {
    href: "/visualize",
    num: "04",
    title: "Visualize",
    sub: "Structures & embeddings",
  },
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
  const tagline = productTagline();

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    return () => {
      document.body.classList.remove("sidebar-collapsed");
    };
  }, [collapsed]);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon" aria-hidden>
          {isLiteMode() ? "◎" : null}
        </div>
        <div className="brand-text">
          <div className="brand-name">{productBrandName()}</div>
          {tagline ? (
            <div className="brand-tagline">{tagline}</div>
          ) : null}
          <div className="brand-ver">{APP_RELEASE}</div>
        </div>
      </div>
      <div className="sidebar-header-row">
        <button
          type="button"
          className="sidebar-toggle"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((c) => !c)}
        >
          ‹
        </button>
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
      {SHOW_DASHBOARD_MODE_IN_SIDEBAR ? (
        <div className="sidebar-dashboard-mode">
          <DashboardModeToggle />
        </div>
      ) : null}
      {isLiteMode() ? (
        <div style={{ marginTop: 12 }}>
          <div className="section-label">Appearance</div>
          <LiteThemeToggle />
        </div>
      ) : (
        <>
          <FullModeStatus />
          <div className="section-label">Appearance</div>
          <AppThemeToggle />
        </>
      )}
      {isLiteMode() ? <LiteBadge /> : null}
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
        {isLiteStaticDemo()
          ? "Static build · no backend · mock data only"
          : "Static UI · HetQML API (Fly) · Settings & Ops live"}
      </div>
    </div>
  );
}

function FullModeStatus() {
  return (
    <div className="status-bar full-build-status">
      <span className="status-dot" />
      <span className="mono">Connected build</span>
      <div
        style={{
          color: "var(--faint)",
          fontSize: 10,
          marginTop: 5,
          lineHeight: 1.45,
        }}
      >
        Live API · catalogs & jobs · optional IBM Quantum path
      </div>
    </div>
  );
}
