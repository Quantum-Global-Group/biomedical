"use client";

import Link from "next/link";

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
  onToggleSidebar: () => void;
}

export function Sidebar({ active, onToggleSidebar }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar-toggle"
        title="Collapse sidebar"
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
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
      <div className="section-label">Appearance</div>
      <div className="theme-row">
        <div className="theme-btn" title="Light (preview)">
          ☼ Light
        </div>
        <div className="theme-btn" title="Dark (preview)">
          ☾ Dark
        </div>
        <div className="theme-btn active" title="Match system">
          ▢ Auto
        </div>
      </div>
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
    </aside>
  );
}
