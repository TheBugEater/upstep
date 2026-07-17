"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface ShellProject {
  id: string;
  name: string;
  feedbackCount: number;
  activeCount: number;
  completedCount: number;
  pendingCount: number;
}

interface Props {
  children: React.ReactNode;
  email: string;
  name: string | null | undefined;
  plan: string;
  projects: ShellProject[];
}

const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  inbox: <><path d="M4 5h16l1 10H3L4 5Z" /><path d="M3 15h5l1.5 2h5l1.5-2h5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3Z" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  sparkle: <path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3ZM5 15l.7 2.3L8 18l-2.3.7L5 21l-.7-2.3L2 18l2.3-.7L5 15ZM19 13l.6 1.9 1.9.6-1.9.6L19 18l-.6-1.9-1.9-.6 1.9-.6L19 13Z" />,
  plug: <><path d="M8 12h8M9 8V4M15 8V4M7 8h10v3a5 5 0 0 1-5 5v4" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  tag: <><path d="M20 13 13 20 4 11V4h7l9 9Z" /><circle cx="8.5" cy="8.5" r="1" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3 2.2c-.6.3-.8.8-.8 1.8M12 17h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  collapse: <path d="m15 18-6-6 6-6" />,
  expand: <path d="m9 18 6-6-6-6" />,
  logout: <path d="m10 17 5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />,
};

type IconName = keyof typeof paths;

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`h-[18px] w-[18px] ${className}`} aria-hidden>{paths[name]}</svg>;
}

export function DashboardShell({ children, email, name, plan, projects }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [liveProjects, setLiveProjects] = useState(projects);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem("upstep:sidebar") === "collapsed") setExpanded(false);
  }, []);

  useEffect(() => setLiveProjects(projects), [projects]);

  useEffect(() => {
    function updateCounts(event: Event) {
      const detail = (event as CustomEvent<Partial<ShellProject> & { id: string }>).detail;
      setLiveProjects((current) => current.map((project) => project.id === detail.id ? { ...project, ...detail } : project));
    }
    window.addEventListener("upstep:project-counts", updateCounts);
    return () => window.removeEventListener("upstep:project-counts", updateCounts);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProjectMenuOpen(false);
    setProfileOpen(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false);
    }
    window.addEventListener("mousedown", closeMenus);
    return () => window.removeEventListener("mousedown", closeMenus);
  }, []);

  function toggleExpanded() {
    setExpanded((value) => {
      localStorage.setItem("upstep:sidebar", value ? "collapsed" : "expanded");
      return !value;
    });
  }

  const currentProjectId = pathname.match(/\/dashboard\/projects\/([^/]+)/)?.[1];
  const currentProject = liveProjects.find((project) => project.id === currentProjectId);
  const activeTab = searchParams.get("tab") ?? "feedback";
  const activePanel = searchParams.get("panel");
  const panelExpanded = expanded || mobileOpen;
  const pageTitle = currentProject
    ? ({ feedback: "Feedback", completed: "Completed", pending: "Pending review", mcp: "MCP", integrations: "Integrations", settings: "Settings" }[activeTab] ?? "Feedback")
    : pathname.startsWith("/dashboard/billing") ? "Billing" : pathname.startsWith("/dashboard/projects/new") ? "New project" : "Overview";

  const projectHref = (tab: string, panel?: string) => currentProject ? `/dashboard/projects/${currentProject.id}?tab=${tab}${panel ? `&panel=${panel}` : ""}` : "/dashboard";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-line bg-card/95 px-3 backdrop-blur-xl lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface" aria-label="Open navigation"><Icon name="menu" /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{pageTitle}</p>{currentProject && <p className="truncate text-[10px] text-faint">{currentProject.name}</p>}</div>
        {currentProject && <Link href={projectHref("feedback")} className="grid h-8 w-8 place-items-center rounded-lg bg-clay text-white" aria-label="New task"><Icon name="plus" className="h-4 w-4" /></Link>}
      </header>

      {mobileOpen && <button className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <aside className={`fixed inset-y-0 left-0 z-[70] flex w-[268px] flex-col border-r border-line bg-card transition-[width,transform] duration-200 ${expanded ? "lg:w-[240px]" : "lg:w-[60px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className={`flex h-14 shrink-0 items-center border-b border-line ${panelExpanded ? "px-3" : "justify-center"}`}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={30} />
            {panelExpanded && <span className="text-[14px] font-bold tracking-[-0.02em] text-ink">Upstep</span>}
          </Link>
          <button onClick={() => setMobileOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted lg:hidden" aria-label="Close navigation"><Icon name="close" /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2 py-3">
          <div ref={projectMenuRef} className="relative">
            <button onClick={() => setProjectMenuOpen((value) => !value)} className={`flex h-11 w-full items-center rounded-lg border border-line bg-surface/60 text-left transition hover:border-line-strong hover:bg-surface ${panelExpanded ? "gap-2.5 px-2" : "justify-center"}`} title={currentProject?.name ?? "Select project"}>
              <ProjectAvatar project={currentProject} />
              {panelExpanded && <><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{currentProject?.name ?? "Select project"}</span><span className="block truncate text-[9px] font-medium uppercase tracking-[0.1em] text-faint">{currentProject ? `${currentProject.feedbackCount} feedback` : `${liveProjects.length} projects`}</span></span><Icon name="chevron" className={`h-4 w-4 text-faint transition ${projectMenuOpen ? "rotate-180" : ""}`} /></>}
            </button>

            {projectMenuOpen && (
              <div className={`absolute top-12 z-50 overflow-hidden rounded-xl border border-line bg-card p-1.5 shadow-lift ${panelExpanded ? "inset-x-0" : "left-0 w-64"}`}>
                <div className="px-2 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-faint">Switch project</div>
                <div className="max-h-64 overflow-y-auto">
                  {liveProjects.map((project) => <Link key={project.id} href={`/dashboard/projects/${project.id}`} className={`flex items-center gap-2.5 rounded-lg px-2 py-2 transition hover:bg-surface ${project.id === currentProjectId ? "bg-surface" : ""}`}><ProjectAvatar project={project} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-ink">{project.name}</span><span className="block text-[10px] text-faint">{project.activeCount} active</span></span>{project.id === currentProjectId && <span className="h-1.5 w-1.5 rounded-full bg-clay" />}</Link>)}
                </div>
                <div className="mt-1 border-t border-line pt-1"><Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted hover:bg-surface hover:text-ink"><Icon name="overview" className="h-4 w-4" />All projects</Link><Link href="/dashboard/projects/new" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted hover:bg-surface hover:text-ink"><Icon name="plus" className="h-4 w-4" />Create project</Link></div>
              </div>
            )}
          </div>

          <nav className="mt-4 min-h-0 flex-1 overflow-y-auto scrollbar-none">
            {!currentProject ? (
              <NavGroup expanded={panelExpanded}><NavItem href="/dashboard" label="Overview" icon="overview" active={pathname === "/dashboard"} expanded={panelExpanded} /></NavGroup>
            ) : (
              <>
                <NavGroup label="Workspace" expanded={panelExpanded}>
                  <NavItem href={projectHref("feedback")} label="Feedback" icon="inbox" active={activeTab === "feedback"} count={currentProject.activeCount} expanded={panelExpanded} />
                  <NavItem href={projectHref("completed")} label="Completed" icon="check" active={activeTab === "completed"} count={currentProject.completedCount} expanded={panelExpanded} />
                  <NavItem href={projectHref("pending")} label="Pending review" icon="clock" active={activeTab === "pending"} count={currentProject.pendingCount} attention={currentProject.pendingCount > 0} expanded={panelExpanded} />
                </NavGroup>
                <NavGroup label="Connect" expanded={panelExpanded}>
                  <NavItem href={projectHref("mcp")} label="MCP & agents" icon="sparkle" active={activeTab === "mcp"} expanded={panelExpanded} />
                  <NavItem href={projectHref("integrations")} label="Integrations" icon="plug" active={activeTab === "integrations"} expanded={panelExpanded} />
                </NavGroup>
                <NavGroup label="Manage" expanded={panelExpanded}>
                  <NavItem href={projectHref("settings", "statuses")} label="Statuses" icon="sliders" active={activeTab === "settings" && activePanel === "statuses"} expanded={panelExpanded} />
                  <NavItem href={projectHref("settings", "labels")} label="Labels" icon="tag" active={activeTab === "settings" && activePanel === "labels"} expanded={panelExpanded} />
                  <NavItem href={projectHref("settings")} label="Project settings" icon="gear" active={activeTab === "settings" && !activePanel} expanded={panelExpanded} />
                </NavGroup>
              </>
            )}
          </nav>

          <div className="space-y-0.5 border-t border-line pt-3">
            <NavItem href="/dashboard/billing" label="Billing & plan" icon="card" active={pathname.startsWith("/dashboard/billing")} expanded={panelExpanded} />
            <NavItem href="/guides" label="Help & guides" icon="help" active={false} expanded={panelExpanded} />
          </div>
        </div>

        <div className="relative border-t border-line p-2">
          {profileOpen && <div className={`absolute bottom-14 z-50 rounded-xl border border-line bg-card p-1.5 shadow-lift ${panelExpanded ? "inset-x-2" : "left-2 w-60"}`}><div className="border-b border-line px-2.5 py-2"><p className="truncate text-xs font-semibold text-ink">{name || email}</p><p className="truncate text-[10px] text-faint">{email}</p></div><div className="flex items-center justify-between px-2.5 py-1.5"><span className="text-xs text-muted">Theme</span><ThemeToggle className="!h-7 !w-7 !border-0 !bg-transparent" /></div><button onClick={() => signOut({ callbackUrl: "/" })} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted hover:bg-surface hover:text-danger"><Icon name="logout" className="h-4 w-4" />Sign out</button></div>}
          <button onClick={() => setProfileOpen((value) => !value)} className={`flex h-10 w-full items-center rounded-lg hover:bg-surface ${panelExpanded ? "gap-2.5 px-1.5" : "justify-center"}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-[10px] font-bold text-primary-fg">{(name?.[0] || email[0] || "U").toUpperCase()}</span>{panelExpanded && <><span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-medium text-ink">{name || email.split("@")[0]}</span><span className="block text-[9px] font-semibold uppercase tracking-wider text-faint">{plan}</span></span><span className="text-xs text-faint">•••</span></>}</button>
        </div>

        <button onClick={toggleExpanded} className="absolute -right-3 top-20 hidden h-6 w-6 place-items-center rounded-full border border-line bg-card text-faint shadow-soft hover:text-ink lg:grid" aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}><Icon name={expanded ? "collapse" : "expand"} className="h-3 w-3" /></button>
      </aside>

      <main className={`min-h-screen pt-14 transition-[padding] duration-200 lg:pt-0 ${expanded ? "lg:pl-[240px]" : "lg:pl-[60px]"}`}>{children}</main>
    </div>
  );
}

function ProjectAvatar({ project }: { project: ShellProject | undefined }) {
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-card text-[10px] font-bold text-ink">{project?.name[0]?.toUpperCase() ?? "+"}</span>;
}

function NavGroup({ label, expanded, children }: { label?: string; expanded: boolean; children: React.ReactNode }) {
  return <div className="mb-4">{expanded && label && <div className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-faint">{label}</div>}<div className="space-y-0.5">{children}</div></div>;
}

function NavItem({ href, label, icon, active, count, attention = false, expanded }: { href: string; label: string; icon: IconName; active: boolean; count?: number; attention?: boolean; expanded: boolean }) {
  return <Link href={href} title={label} className={`relative flex h-9 items-center rounded-lg text-xs transition ${expanded ? "gap-2.5 px-2" : "justify-center"} ${active ? "bg-surface font-semibold text-ink" : "font-medium text-muted hover:bg-surface/70 hover:text-ink"}`}><Icon name={icon} className={active ? "text-clay" : "text-faint"} />{expanded && <><span className="min-w-0 flex-1 truncate">{label}</span>{typeof count === "number" && count > 0 && <span className={`min-w-5 rounded px-1 py-0.5 text-center text-[9px] font-semibold ${attention ? "bg-clay text-white" : "bg-line text-muted"}`}>{count > 99 ? "99+" : count}</span>}</>}{!expanded && attention && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-clay" />}{active && !expanded && <span className="absolute -left-2 h-4 w-0.5 rounded-r bg-clay" />}</Link>;
}
