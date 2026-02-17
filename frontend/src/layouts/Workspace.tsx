import { createContext, useContext, useState } from "react";
import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import {
  Activity, ArrowLeft, BarChart3, BookOpen, ChevronRight, FileScan,
  FolderOpen, GitCompareArrows, LayoutDashboard, LogOut, Menu, Play, Settings, X,
} from "lucide-react";
import type { Project } from "../types/domain";
import { useResource } from "../hooks/useResource";
import { useAuth } from "../features/auth/AuthContext";
import { ErrorPanel, Loading } from "../components/Feedback";
import { useMutation } from "../hooks/useMutation";

const ProjectContext = createContext<{ project: Project; refresh: () => void } | null>(null);

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("Project workspace is required.");
  return context;
}

const navigation = [
  { path: "", label: "Overview", icon: LayoutDashboard },
  { path: "/datasets", label: "Datasets", icon: FolderOpen },
  { path: "/schemas", label: "Schemas", icon: BookOpen },
  { path: "/runs", label: "Extraction runs", icon: Play },
  { path: "/compare", label: "Compare runs", icon: GitCompareArrows },
  { path: "/metrics", label: "Metrics", icon: BarChart3 },
  { path: "/audit", label: "Audit log", icon: Activity },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Workspace() {
  const { projectId } = useParams();
  const resource = useResource<Project>(projectId ? "/projects/" + projectId : null);
  const auth = useAuth();
  const mutation = useMutation();
  const [menu, setMenu] = useState(false);
  const root = "/projects/" + projectId;
  return <div className="workspace">
    {menu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenu(false)} />}
    <aside className={"sidebar" + (menu ? " open" : "")}>
      <Link to="/projects" className="brand"><FileScan size={27} /><span>DocIntel <b>Bench</b></span></Link>
      <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMenu(false)}>
        <X size={20} />
      </button>
      <Link to="/projects" className="back-link"><ArrowLeft size={15} />All projects</Link>
      <div className="project-label"><span>WORKSPACE</span><strong>{resource.data?.name ?? "Project"}</strong></div>
      <nav aria-label="Project navigation">
        {navigation.map(item => <NavLink key={item.path} to={root + item.path} end={item.path === ""}
          onClick={() => setMenu(false)} className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
          <item.icon size={18} /><span>{item.label}</span>
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="local-note"><span className="online-dot" />Private evaluation workspace</div>
        <div className="user-row">
          <span className="avatar">{auth.user?.display_name.slice(0, 2).toUpperCase()}</span>
          <div><strong>{auth.user?.display_name}</strong><small>{auth.user?.email}</small></div>
          <button className="icon-button" aria-label="Sign out" disabled={mutation.pending}
            onClick={() => void mutation.execute(auth.logout)}><LogOut size={17} /></button>
        </div>
        {mutation.error && <small role="alert">{mutation.error.message}</small>}
      </div>
    </aside>
    <div className="workspace-main">
      <div className="topbar">
        <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenu(true)}>
          <Menu size={21} />
        </button>
        <div className="breadcrumbs"><Link to="/projects">Projects</Link><ChevronRight size={14} />
          <span>{resource.data?.name ?? "Loading…"}</span></div>
        <span className="topbar-label">DOCUMENT EVALUATION</span>
      </div>
      <main className="page">
        {resource.loading ? <Loading /> : resource.error
          ? <ErrorPanel error={resource.error} retry={resource.refresh} />
          : resource.data && <ProjectContext.Provider value={{ project: resource.data, refresh: resource.refresh }}>
            {resource.data.archived && <div className="notice">This project is archived. Restore it in Settings to make changes.</div>}
            <Outlet />
          </ProjectContext.Provider>}
      </main>
    </div>
  </div>;
}
