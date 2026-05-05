import { Sidebar } from "./Sidebar";

/**
 * Server component shell. Renders the persistent sidebar + main slot. The
 * collapse-state is owned by the Sidebar (the only thing that needs to be
 * interactive), so the shell itself ships zero JS to the browser.
 */
export function AppShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar active={active} />
      <div className="sidebar-floating-tooltip" aria-hidden="true" />
      <main className="main">{children}</main>
    </>
  );
}
