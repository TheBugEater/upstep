"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface ShellProject {
  id: string;
  name: string;
  feedbackCount: number;
  pendingCount: number;
}

interface Props {
  children: React.ReactNode;
  email: string;
  name: string | null | undefined;
  plan: string;
  projects: ShellProject[];
}

const icons = {
  home: <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z M9 21v-8h6v8" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18 M8 15h2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  panel: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18" /></>,
  collapse: <path d="m15 18-6-6 6-6" />,
  expand: <path d="m9 18 6-6-6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: <path d="M15 4h5v5M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.2 2.3c-.7.3-.9.8-.9 1.7M12 17h.01" /></>,
  logout: <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />,
};

function Icon({ name, className = "" }: { name: keyof typeof icons; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${className}`} aria-hidden>{icons[name]}</svg>;
}

export function DashboardShell({ children, email, name, plan, projects }: Props) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("upstep:sidebar");
    if (saved === "collapsed") setExpanded(false);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  function toggleExpanded() {
    setExpanded((value) => {
      localStorage.setItem("upstep:sidebar", value ? "collapsed" : "expanded");
      return !value;
    });
  }

  const currentProjectId = pathname.match(/\/dashboard\/projects\/([^/]+)/)?.[1];
  const currentProject = projects.find((project) => project.id === currentProjectId);
  const panelExpanded = expanded || mobileOpen;
  const title = pathname === "/dashboard"
    ? "Overview"
    : pathname.startsWith("/dashboard/billing")
      ? "Billing"
      : pathname.startsWith("/dashboard/projects/new")
        ? "New project"
        : currentProject?.name ?? "Dashboard";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-line bg-card/90 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-muted" aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Upstep</p>
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
          </div>
        </div>
        <Link href="/dashboard/projects/new" className="grid h-9 w-9 place-items-center rounded-xl bg-clay text-white" aria-label="New project"><Icon name="plus" /></Link>
      </header>

      {mobileOpen && <button className="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <aside className={`fixed inset-y-0 left-0 z-[70] flex flex-col border-r border-line bg-card transition-[width,transform] duration-300 ease-fluid ${expanded ? "lg:w-64" : "lg:w-[72px]"} w-72 ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-16 items-center border-b border-line ${panelExpanded ? "px-4" : "px-[19px]"}`}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <LogoMark size={34} />
            <div className={`overflow-hidden transition-all duration-200 ${panelExpanded ? "w-36 opacity-100" : "w-0 opacity-0"}`}>
              <p className="text-[15px] font-bold tracking-tight text-ink">Upstep</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-faint">Feedback OS</p>
            </div>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface lg:hidden" aria-label="Close navigation"><Icon name="close" /></button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col px-3 py-4">
          <div className="space-y-1">
            <NavItem href="/dashboard" label="Overview" icon="home" active={pathname === "/dashboard"} expanded={panelExpanded} />
            <NavItem href="/dashboard/billing" label="Billing & plan" icon="card" active={pathname.startsWith("/dashboard/billing")} expanded={panelExpanded} />
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className={`mb-2 flex h-7 items-center ${panelExpanded ? "justify-between px-2" : "justify-center"}`}>
              {panelExpanded ? <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">Projects</span> : <span className="h-px w-7 bg-line" />}
              {panelExpanded && <Link href="/dashboard/projects/new" className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-surface hover:text-clay" title="New project"><Icon name="plus" className="h-4 w-4" /></Link>}
            </div>

            <div className="min-h-0 space-y-1 overflow-y-auto scrollbar-none">
              {projects.map((project) => (
                <ProjectItem key={project.id} project={project} active={project.id === currentProjectId} expanded={panelExpanded} />
              ))}
              {projects.length === 0 && panelExpanded && <p className="px-2 py-3 text-xs leading-relaxed text-faint">No projects yet. Create one to start collecting feedback.</p>}
            </div>

            <Link href="/dashboard/projects/new" className={`mt-3 flex h-10 items-center rounded-xl border border-dashed border-line-strong text-muted transition hover:border-clay/40 hover:bg-clay/5 hover:text-clay ${panelExpanded ? "gap-3 px-3" : "justify-center"}`} title="New project">
              <Icon name="plus" className="h-[18px] w-[18px]" />
              {panelExpanded && <span className="text-xs font-semibold">New project</span>}
            </Link>
          </div>

          <div className="mt-4 space-y-1 border-t border-line pt-4">
            <Link href="/guides" className={`flex h-10 items-center rounded-xl text-muted transition hover:bg-surface hover:text-ink ${panelExpanded ? "gap-3 px-3" : "justify-center"}`} title="Guides">
              <Icon name="help" /><span className={panelExpanded ? "text-xs font-medium" : "hidden"}>Guides</span>{panelExpanded && <span className="ml-auto text-faint">→</span>}
            </Link>
          </div>
        </nav>

        <div className="relative border-t border-line p-3">
          {profileOpen && (
            <div className={`absolute bottom-[68px] rounded-2xl border border-line bg-card p-1.5 shadow-lift ${panelExpanded ? "inset-x-3" : "left-3 w-60"}`}>
              <div className="border-b border-line px-3 py-2.5">
                <p className="truncate text-xs font-semibold text-ink">{name || email}</p>
                <p className="truncate text-[11px] text-faint">{email}</p>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted">Theme</span><ThemeToggle className="!h-8 !w-8" />
              </div>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-muted hover:bg-surface hover:text-danger"><Icon name="logout" className="h-4 w-4" />Sign out</button>
            </div>
          )}
          <button onClick={() => setProfileOpen((value) => !value)} className={`flex h-11 w-full items-center rounded-xl transition hover:bg-surface ${panelExpanded ? "gap-3 px-2" : "justify-center"}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-primary text-xs font-bold text-primary-fg">{(name?.[0] || email[0] || "U").toUpperCase()}</span>
            {panelExpanded && <><span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold text-ink">{name || email.split("@")[0]}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-clay">{plan} plan</span></span><span className="text-faint">•••</span></>}
          </button>
        </div>

        <button onClick={toggleExpanded} className="absolute -right-3 top-24 hidden h-7 w-7 place-items-center rounded-full border border-line bg-card text-faint shadow-soft hover:text-ink lg:grid" aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"} title={expanded ? "Collapse sidebar" : "Expand sidebar"}><Icon name={expanded ? "collapse" : "expand"} className="h-3.5 w-3.5" /></button>
      </aside>

      <main className={`min-h-screen pt-16 transition-[padding] duration-300 ease-fluid lg:pt-0 ${expanded ? "lg:pl-64" : "lg:pl-[72px]"}`}>
        {children}
      </main>
    </div>
  );
}

function NavItem({ href, label, icon, active, expanded }: { href: string; label: string; icon: keyof typeof icons; active: boolean; expanded: boolean }) {
  return <Link href={href} title={label} className={`relative flex h-11 items-center rounded-xl transition ${expanded ? "gap-3 px-3" : "justify-center"} ${active ? "bg-primary text-primary-fg shadow-soft" : "text-muted hover:bg-surface hover:text-ink"}`}><Icon name={icon} />{expanded && <span className="text-xs font-semibold">{label}</span>}{active && !expanded && <span className="absolute -left-3 h-5 w-1 rounded-r-full bg-clay" />}</Link>;
}

function ProjectItem({ project, active, expanded }: { project: ShellProject; active: boolean; expanded: boolean }) {
  const initial = project.name[0]?.toUpperCase() ?? "P";
  return <Link href={`/dashboard/projects/${project.id}`} title={project.name} className={`group relative flex min-h-11 items-center rounded-xl transition ${expanded ? "gap-3 px-2" : "justify-center"} ${active ? "bg-clay/10 text-clay" : "text-muted hover:bg-surface hover:text-ink"}`}>
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border text-xs font-bold ${active ? "border-clay/25 bg-clay text-white" : "border-line bg-surface text-muted group-hover:border-line-strong"}`}>{initial}</span>
    {expanded && <><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{project.name}</span><span className="block text-[10px] text-faint">{project.feedbackCount} feedback</span></span>{project.pendingCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[9px] font-bold text-white">{project.pendingCount > 99 ? "99+" : project.pendingCount}</span>}</>}
    {!expanded && project.pendingCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full border-2 border-card bg-clay" />}
  </Link>;
}
