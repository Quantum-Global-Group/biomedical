"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
    return () => {
      document.body.classList.remove("sidebar-collapsed");
    };
  }, [sidebarCollapsed]);

  return (
    <>
      <Sidebar
        active={active}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
      />
      <div className="sidebar-floating-tooltip" aria-hidden="true" />
      <main className="main">{children}</main>
    </>
  );
}
