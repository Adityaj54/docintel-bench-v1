import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, FileScan, Folder, LogOut, Plus, Search } from "lucide-react";
import { query } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Loading, PageHeader } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { useToast } from "../../components/Toast";
import { useResource } from "../../hooks/useResource";
import { useMutation } from "../../hooks/useMutation";
import type { Page, Project } from "../../types/domain";
import { dateTime } from "../../utils/format";
import { useAuth } from "../auth/AuthContext";
import { ProjectForm } from "./ProjectForm";

export function ProjectsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const mutation = useMutation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState("false");
  const [offset, setOffset] = useState(0);
  const resource = useResource<Page<Project>>("/projects" + query({ search, archived, offset, limit: 12 }));
  return <div className="projects-layout">
    <header className="projects-topbar">
      <Link to="/projects" className="brand"><FileScan size={27} /><span>DocIntel <b>Bench</b></span></Link>
      <div className="actions"><span>{auth.user?.display_name}</span>
        <button className="button secondary small" disabled={mutation.pending}
          onClick={() => void mutation.execute(auth.logout)}><LogOut size={15} />Sign out</button>
      </div>
    </header>
    <main className="projects-main">
      <PageHeader eyebrow="YOUR WORKSPACE" title="Projects"
        description="A home for every document extraction experiment."
        actions={<button className="button primary" onClick={() => setOpen(true)}><Plus size={18} />New project</button>} />
      <ErrorPanel error={mutation.error} />
      <div className="toolbar">
        <label className="search-input"><Search size={17} />
          <input aria-label="Search projects" placeholder="Search projects…" value={search}
            onChange={event => { setSearch(event.target.value); setOffset(0); }} />
        </label>
        <select aria-label="Project archive filter" value={archived}
          onChange={event => { setArchived(event.target.value); setOffset(0); }}>
          <option value="false">Active projects</option><option value="true">Archived projects</option>
          <option value="">All projects</option>
        </select>
      </div>
      {resource.loading ? <Loading /> : resource.error ? <ErrorPanel error={resource.error} retry={resource.refresh} />
        : resource.data?.items.length ? <>
          <div className="project-grid">
            {resource.data.items.map(project => <Link to={"/projects/" + project.id} className="project-card" key={project.id}>
              <div className="project-card-top"><span className="folder-icon"><Folder size={24} /></span>
                <ArrowUpRight size={20} /></div>
              <h2>{project.name}</h2>
              <p>{project.description || "No description yet."}</p>
              <div className="project-card-footer">
                <span>{project.archived ? "Archived" : "Active"}</span>
                <small>Updated {dateTime(project.updated_at)}</small>
              </div>
            </Link>)}
          </div>
          <Pagination {...resource.data} onChange={setOffset} />
        </> : <Empty title="Create your first project"
          description="Group your schemas, datasets, and extraction runs in a focused workspace."
          action={<button className="button primary" onClick={() => setOpen(true)}>Create project</button>} />}
    </main>
    <Dialog open={open} onClose={() => setOpen(false)} title="New project">
      <ProjectForm onCancel={() => setOpen(false)} onSaved={project => {
        toast("Project created.");
        navigate("/projects/" + project.id);
      }} />
    </Dialog>
  </div>;
}
