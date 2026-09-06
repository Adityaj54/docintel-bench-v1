import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "./features/auth/AuthContext";
import { AuthPage } from "./features/auth/AuthPage";
import { ProjectsPage } from "./features/projects/ProjectsPage";
import { Dashboard } from "./features/projects/Dashboard";
import { Workspace } from "./layouts/Workspace";
import { DatasetsPage } from "./features/datasets/DatasetsPage";
import { DatasetDetail } from "./features/datasets/DatasetDetail";
import { DocumentDetail } from "./features/documents/DocumentDetail";
import { SchemasPage } from "./features/schemas/SchemasPage";
import { SchemaEditor } from "./features/schemas/SchemaEditor";
import { ErrorPanel, Loading } from "./components/Feedback";

function RequireSession({ children }: { children: ReactElement }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <Loading label="Restoring your session…" />;
  if (auth.error) {
    return <main className="page">
      <ErrorPanel error={auth.error} retry={auth.reload} />
    </main>;
  }
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function NotFound() {
  return <main className="page">
    <div className="empty">
      <h3>That page does not exist</h3>
      <p>The link may be out of date, or the project may have been removed.</p>
      <a className="button primary" href="/projects">Back to projects</a>
    </div>
  </main>;
}

export function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/projects" replace />} />
    <Route path="/login" element={<AuthPage />} />
    <Route path="/register" element={<AuthPage register />} />
    <Route path="/projects" element={<RequireSession><ProjectsPage /></RequireSession>} />
    <Route path="/projects/:projectId" element={<RequireSession><Workspace /></RequireSession>}>
      <Route index element={<Dashboard />} />
      <Route path="datasets" element={<DatasetsPage />} />
      <Route path="datasets/:datasetId" element={<DatasetDetail />} />
      <Route path="documents/:documentId" element={<DocumentDetail />} />
      <Route path="schemas" element={<SchemasPage />} />
      <Route path="schemas/new" element={<SchemaEditor />} />
      <Route path="schemas/:schemaId" element={<SchemaEditor />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>;
}
