import { Link } from "react-router-dom";
import { ArrowRight, Plus } from "lucide-react";
import { useProject } from "../../layouts/Workspace";
import { useResource } from "../../hooks/useResource";
import type { MetricReport, Page, Run } from "../../types/domain";
import { ErrorPanel, Loading, PageHeader, Section } from "../../components/Feedback";
import { SummaryCards } from "../../components/Metrics";
import { Breakdown, VolumeChart } from "../../components/Charts";
import { RunTable } from "../runs/RunTable";

export function Dashboard() {
  const { project } = useProject();
  const metrics = useResource<MetricReport>("/projects/" + project.id + "/metrics", 5000);
  const runs = useResource<Page<Run>>("/projects/" + project.id + "/runs?limit=5", 5000);
  const root = "/projects/" + project.id;
  return <>
    <PageHeader eyebrow="WORKSPACE OVERVIEW" title={project.name}
      description={project.description || "Track quality across your document extraction pipeline."}
      actions={<Link className="button primary" to={root + "/runs?new=1"}><Plus size={17} />New extraction</Link>} />
    <ErrorPanel error={metrics.error} retry={metrics.refresh} />
    {metrics.loading ? <Loading /> : metrics.data && <>
      <SummaryCards summary={metrics.data.summary} />
      <div className="dashboard-charts">
        <Section title="Extraction activity" description="Daily volume across all providers">
          <VolumeChart points={metrics.data.volume} />
        </Section>
        <Section title="Document mix" description="Files in active datasets">
          <Breakdown values={metrics.data.mime_types} />
        </Section>
      </div>
    </>}
    <Section title="Recent runs" description="Your latest extraction experiments"
      actions={<Link className="text-link" to={root + "/runs"}>View all runs<ArrowRight size={16} /></Link>}>
      <ErrorPanel error={runs.error} retry={runs.refresh} />
      {runs.loading ? <Loading /> : <RunTable runs={runs.data?.items ?? []} projectId={project.id} />}
    </Section>
    <div className="getting-started">
      <div><strong>A repeatable evaluation starts with good ground truth.</strong>
        <p>Upload documents, define a schema, and annotate trusted values before comparing configurations.</p></div>
      <Link to={root + "/datasets"} className="button secondary">Browse datasets<ArrowRight size={16} /></Link>
    </div>
  </>;
}
