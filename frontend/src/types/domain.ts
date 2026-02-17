export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Entity {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface User extends Entity {
  email: string;
  display_name: string;
}

export interface Session extends User {
  csrf_token: string;
}

export interface Project extends Entity {
  owner_id: string;
  name: string;
  description: string;
  archived: boolean;
}

export interface Schema extends Entity {
  project_id: string;
  name: string;
  description: string;
  version: number;
  definition: Record<string, Json>;
  active: boolean;
  created_by: string;
}

export interface Dataset extends Entity {
  project_id: string;
  name: string;
  description: string;
  document_count: number;
}

export interface Artifact {
  page: number;
  width: number;
  height: number;
  mime_type: string;
  url: string;
}

export interface Failure {
  code: string;
  message: string;
  details?: Record<string, Json>;
}

export interface Document extends Entity {
  dataset_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  page_count: number;
  width: number | null;
  height: number | null;
  status: string;
  error: Failure | null;
  artifacts: Artifact[];
}

export interface GroundTruth extends Entity {
  document_id: string;
  schema_id: string;
  value: Json;
  version: number;
  source: string;
}

export interface ProviderOptions {
  max_tokens: number;
  input_cost_per_million: number;
  output_cost_per_million: number;
  variant: "baseline" | "noisy";
  failure_every: number;
  response_format: "plain" | "fenced" | "wrapped" | "malformed";
}

export interface Provider extends Entity {
  project_id: string;
  name: string;
  provider: "mock" | "openai" | "anthropic";
  model: string;
  options: ProviderOptions;
  active: boolean;
  available: boolean;
}

export interface EvaluationOptions {
  normalize_strings: boolean;
  case_sensitive: boolean;
  numeric_tolerance: number;
  relative_tolerance: number;
  array_order: "ordered" | "unordered";
  ignore_extra_fields: boolean;
}

export interface Run extends Entity {
  project_id: string;
  dataset_id: string | null;
  schema_id: string;
  provider_configuration_id: string;
  name: string;
  provider_snapshot: {
    name: string;
    provider: string;
    model: string;
    options: ProviderOptions;
  };
  evaluation_options: EvaluationOptions;
  status: string;
  total_documents: number;
  completed_documents: number;
  failed_documents: number;
  started_at: string | null;
  finished_at: string | null;
}

export interface ValidationIssue {
  path: string;
  validator: string;
  expected: Json;
  received: Json;
  received_type: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  error_count?: number;
}

export interface Difference {
  path: string;
  actual_path: string;
  status: "match" | "changed" | "missing" | "extra" | "type_mismatch";
  expected_present: boolean;
  actual_present: boolean;
  expected: Json;
  actual: Json;
  expected_type: string;
  actual_type: string;
}

export interface Evaluation {
  ground_truth_id: string;
  ground_truth_version: number;
  matched_fields: number;
  total_fields: number;
  precision: number;
  recall: number;
  f1: number;
  score: number;
  differences: Difference[];
  options: EvaluationOptions;
}

export interface Result extends Entity {
  run_id: string;
  document_id: string;
  document_name: string;
  status: string;
  output: Json;
  raw_response: Json;
  normalization_warnings: { path: string; message: string; code?: string }[];
  latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number | string;
  provider: string;
  model: string;
  error: Failure | null;
  attempts: number;
  validation: ValidationReport | null;
  evaluation: Evaluation | null;
}

export interface MetricSummary {
  document_count: number;
  extraction_count: number;
  successful_runs: number;
  failed_runs: number;
  success_rate: number | null;
  validation_success_rate: number | null;
  average_evaluation_score: number | null;
  average_latency_ms: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  estimated_total_cost: number;
  cost_per_document: number;
  failure_count: number;
}

export interface ProviderMetric {
  provider: string;
  model: string;
  total: number;
  success_rate: number;
  validity_rate: number | null;
  average_score: number | null;
  average_latency_ms: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  total_cost: number;
  cost_per_document: number;
  failures: number;
}

export interface MetricReport {
  summary: MetricSummary;
  volume: { date: string; total: number; completed: number; failed: number }[];
  mime_types: { label: string; count: number }[];
  errors: { label: string; count: number }[];
  providers: ProviderMetric[];
}

export interface RunComparison {
  run_id: string;
  name: string;
  status: string;
  metrics: ProviderMetric;
}

export interface Audit extends Entity {
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  details: Json;
}

export interface Webhook extends Entity {
  project_id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
}

export interface Delivery extends Entity {
  webhook_id: string;
  event: string;
  status: string;
  attempts: number;
  last_status_code: number | null;
  last_error: string | null;
  attempt_history: Record<string, Json>[];
}

export interface Settings {
  providers: Record<string, boolean>;
  storage_backend: string;
  max_upload_bytes: number;
  max_pdf_pages: number;
  max_run_documents: number;
  webhook_enabled: boolean;
  webhook_allowed_hosts: string[];
}
