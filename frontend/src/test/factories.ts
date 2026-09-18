import type {
  Audit, Dataset, Delivery, Document, Evaluation, GroundTruth, MetricReport, MetricSignificance,
  Page, Project, Provider, Result, Run, RunComparison, RunSignificance, Schema, Session, Settings,
  ValidationReport, Webhook,
} from "../types/domain";

const created = "2026-03-01T10:00:00Z";
const updated = "2026-03-02T11:30:00Z";

export function page<T>(items: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return { items, total: items.length, offset: 0, limit: 20, ...overrides };
}

export function aSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "u1",
    created_at: created,
    updated_at: updated,
    email: "ada@example.com",
    display_name: "Ada Lovelace",
    csrf_token: "csrf-token",
    ...overrides,
  };
}

export function aProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    created_at: created,
    updated_at: updated,
    owner_id: "u1",
    name: "Invoice benchmark",
    description: "Quarterly supplier invoices.",
    archived: false,
    ...overrides,
  };
}

export function aDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: "d1",
    created_at: created,
    updated_at: updated,
    project_id: "p1",
    name: "September invoices",
    description: "Scanned supplier invoices.",
    document_count: 3,
    ...overrides,
  };
}

export function aDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc1",
    created_at: created,
    updated_at: updated,
    dataset_id: "d1",
    original_filename: "invoice-104.pdf",
    mime_type: "application/pdf",
    size_bytes: 24576,
    sha256: "a".repeat(64),
    page_count: 2,
    width: 1200,
    height: 1600,
    status: "ready",
    error: null,
    artifacts: [
      { page: 1, width: 1200, height: 1600, mime_type: "image/png", url: "/api/documents/doc1/pages/1" },
      { page: 2, width: 1200, height: 1600, mime_type: "image/png", url: "/api/documents/doc1/pages/2" },
    ],
    ...overrides,
  };
}

export function aSchema(overrides: Partial<Schema> = {}): Schema {
  return {
    id: "s1",
    created_at: created,
    updated_at: updated,
    project_id: "p1",
    name: "Invoice",
    description: "Header fields and line items.",
    version: 2,
    definition: { type: "object", properties: { total: { type: "number" } }, required: ["total"] },
    active: true,
    created_by: "u1",
    ...overrides,
  };
}

export function aProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "pr1",
    created_at: created,
    updated_at: updated,
    project_id: "p1",
    name: "Mock baseline",
    provider: "mock",
    model: "mock-extract-1",
    options: {
      max_tokens: 4096,
      input_cost_per_million: 1.5,
      output_cost_per_million: 6,
      variant: "baseline",
      failure_every: 0,
      response_format: "plain",
    },
    active: true,
    available: true,
    ...overrides,
  };
}

export function aRun(overrides: Partial<Run> = {}): Run {
  return {
    id: "r1",
    created_at: created,
    updated_at: updated,
    project_id: "p1",
    dataset_id: "d1",
    schema_id: "s1",
    provider_configuration_id: "pr1",
    name: "Baseline run",
    provider_snapshot: {
      name: "Mock baseline",
      provider: "mock",
      model: "mock-extract-1",
      options: aProvider().options,
    },
    evaluation_options: {
      normalize_strings: true,
      case_sensitive: false,
      numeric_tolerance: 0.01,
      relative_tolerance: 0,
      array_order: "ordered",
      ignore_extra_fields: false,
    },
    status: "completed",
    total_documents: 4,
    completed_documents: 3,
    failed_documents: 1,
    started_at: "2026-03-02T11:00:00Z",
    finished_at: "2026-03-02T11:05:00Z",
    ...overrides,
  };
}

export function aValidationReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    valid: false,
    error_count: 1,
    errors: [{
      path: "$.total",
      validator: "type",
      expected: "number",
      received: "12,40",
      received_type: "string",
      message: "'12,40' is not of type 'number'",
    }],
    ...overrides,
  };
}

export function anEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    ground_truth_id: "gt1",
    ground_truth_version: 3,
    matched_fields: 8,
    total_fields: 10,
    precision: 0.8,
    recall: 0.9,
    f1: 0.85,
    score: 0.8,
    options: aRun().evaluation_options,
    differences: [
      {
        path: "$.total", actual_path: "$.total", status: "changed",
        expected_present: true, actual_present: true, expected: 120.5, actual: 121,
        expected_type: "number", actual_type: "number",
      },
      {
        path: "$.vendor", actual_path: "$.vendor", status: "match",
        expected_present: true, actual_present: true, expected: "Acme", actual: "Acme",
        expected_type: "string", actual_type: "string",
      },
    ],
    ...overrides,
  };
}

export function aResult(overrides: Partial<Result> = {}): Result {
  return {
    id: "res1",
    created_at: created,
    updated_at: updated,
    run_id: "r1",
    document_id: "doc1",
    document_name: "invoice-104.pdf",
    status: "completed",
    output: { total: 121, vendor: "Acme" },
    raw_response: null,
    normalization_warnings: [],
    latency_ms: 842.5,
    input_tokens: 1800,
    output_tokens: 240,
    estimated_cost: 0.0042,
    provider: "mock",
    model: "mock-extract-1",
    error: null,
    attempts: 1,
    validation: { valid: true, errors: [] },
    evaluation: anEvaluation(),
    ...overrides,
  };
}

export function aGroundTruth(overrides: Partial<GroundTruth> = {}): GroundTruth {
  return {
    id: "gt1",
    created_at: created,
    updated_at: updated,
    document_id: "doc1",
    schema_id: "s1",
    value: { total: 120.5, vendor: "Acme" },
    version: 3,
    source: "manual",
    ...overrides,
  };
}

export function aMetricReport(overrides: Partial<MetricReport> = {}): MetricReport {
  return {
    summary: {
      document_count: 12,
      extraction_count: 30,
      successful_runs: 4,
      failed_runs: 1,
      success_rate: 0.9,
      validation_success_rate: 0.83,
      average_evaluation_score: 0.76,
      average_latency_ms: 910,
      p50_latency_ms: 880,
      p95_latency_ms: 1500,
      estimated_total_cost: 1.24,
      cost_per_document: 0.1,
      failure_count: 3,
    },
    volume: [
      { date: "2026-03-01", total: 5, completed: 4, failed: 1 },
      { date: "2026-03-02", total: 7, completed: 7, failed: 0 },
    ],
    mime_types: [{ label: "application/pdf", count: 9 }, { label: "image/png", count: 3 }],
    errors: [{ label: "PROVIDER_TIMEOUT", count: 2 }],
    providers: [{
      provider: "mock",
      model: "mock-extract-1",
      total: 30,
      success_rate: 0.9,
      validity_rate: 0.83,
      average_score: 0.76,
      average_latency_ms: 910,
      p50_latency_ms: 880,
      p95_latency_ms: 1500,
      total_cost: 1.24,
      cost_per_document: 0.1,
      failures: 3,
    }],
    ...overrides,
  };
}

export function aComparison(overrides: Partial<RunComparison> = {}): RunComparison {
  return {
    run_id: "r1",
    name: "Baseline run",
    status: "completed",
    metrics: aMetricReport().providers[0],
    ...overrides,
  };
}

export function aMetricSignificance(overrides: Partial<MetricSignificance> = {}): MetricSignificance {
  return {
    metric: "average_score",
    label: "Evaluation score",
    direction: "higher",
    pairs: 24,
    baseline_mean: 0.76,
    candidate_mean: 0.83,
    difference: 0.07,
    confidence: 0.95,
    confidence_low: 0.03,
    confidence_high: 0.11,
    p_value: 0.002,
    adjusted_p_value: 0.008,
    exact: false,
    minimum_detectable_effect: 0.04,
    verdict: "better",
    ...overrides,
  };
}

export function aRunSignificance(overrides: Partial<RunSignificance> = {}): RunSignificance {
  return {
    run_id: "r2",
    name: "Noisy run",
    baseline_run_id: "r1",
    baseline_name: "Baseline run",
    paired_documents: 24,
    metrics: [aMetricSignificance()],
    ...overrides,
  };
}

export function anAudit(overrides: Partial<Audit> = {}): Audit {
  return {
    id: "a1",
    created_at: created,
    updated_at: updated,
    action: "schema.created",
    entity_type: "schema",
    entity_id: "de6decb8-3803-40d1-9aaf-6f6dc94fa93a",
    user_id: "u1",
    details: { version: 1 },
    ...overrides,
  };
}

export function aWebhook(overrides: Partial<Webhook> = {}): Webhook {
  return {
    id: "w1",
    created_at: created,
    updated_at: updated,
    project_id: "p1",
    name: "Run notifications",
    url: "https://hooks.example.com/receive",
    events: ["run.completed"],
    active: true,
    ...overrides,
  };
}

export function aDelivery(overrides: Partial<Delivery> = {}): Delivery {
  return {
    id: "dl1",
    created_at: created,
    updated_at: updated,
    webhook_id: "w1",
    event: "run.completed",
    status: "delivered",
    attempts: 1,
    last_status_code: 200,
    last_error: null,
    attempt_history: [],
    ...overrides,
  };
}

export function someSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    providers: { mock: true, openai: false, anthropic: false },
    storage_backend: "local",
    max_upload_bytes: 26214400,
    max_pdf_pages: 30,
    max_run_documents: 100,
    webhook_enabled: true,
    webhook_allowed_hosts: ["hooks.example.com"],
    ...overrides,
  };
}
