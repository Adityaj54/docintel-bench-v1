Build a production-style full-stack application called DocIntel Bench: a document intelligence evaluation platform for testing structured extraction from PDFs and images.
The goal is to create a realistic, non-trivial codebase with meaningful architecture and enough genuine production code to satisfy repository-quality checks. Do not create dummy files, generated filler, or artificial code solely to increase line count. The application should be coherent, runnable, testable, and structured like a real internal engineering product.
Users should be able to create projects, define extraction schemas, create datasets, upload PDF/image documents, run extraction jobs through pluggable providers, validate extracted JSON against schemas, compare extraction output against ground truth, and review metrics such as accuracy, latency, cost, validation success, and failures.
Use this stack:
-  Frontend: React + TypeScript + Vite 
-  Backend: Python 3.12 + FastAPI 
-  Database: PostgreSQL + SQLAlchemy + Alembic 
-  Background jobs: Redis + Celery 
-  Validation: Pydantic + JSON Schema 
-  Storage: local filesystem abstraction with an S3-compatible implementation 
-  Testing: pytest + Vitest 
-  Local environment: Docker Compose 
The application must work locally without any external API credentials by providing a deterministic mock extraction provider.
Implement these real domain entities:
-  User 
-  Project 
-  ExtractionSchema 
-  Dataset 
-  Document 
-  ProviderConfiguration 
-  ExtractionRun 
-  ExtractionResult 
-  ValidationResult 
-  GroundTruth 
-  EvaluationResult 
-  AuditLog 
-  WebhookConfiguration 
-  WebhookDelivery 
Use UUID primary keys and proper foreign-key relationships.
Users can create, edit, archive, and browse projects.
A project dashboard should show:
-  document count 
-  extraction count 
-  successful and failed runs 
-  validation success rate 
-  average evaluation score 
-  average latency 
-  estimated total provider cost 
-  recent runs 
Users can define the expected JSON structure for extracted documents using JSON Schema.
Schemas must support versioning. Editing an existing schema must create a new version rather than destroying the previous version.
Provide:
-  create schema 
-  edit/version schema 
-  clone schema 
-  activate/deactivate version 
-  validate sample JSON against schema 
Users can create datasets and upload:
-  PDF 
-  PNG 
-  JPG/JPEG 
-  WebP 
Validate:
-  file type 
-  MIME type 
-  file size 
-  empty files 
-  duplicate documents 
Calculate a SHA-256 hash and prevent duplicate content within the same dataset.
Store metadata such as:
-  original filename 
-  MIME type 
-  file size 
-  SHA-256 
-  storage key 
-  page count 
-  image dimensions 
-  processing status 
Create a dedicated preprocessing service.
For PDFs:
-  determine page count 
-  render pages into images 
-  save generated artifacts 
-  configurable rendering DPI 
For images:
-  inspect dimensions 
-  normalize orientation 
-  resize when necessary 
Do not put preprocessing logic directly inside route handlers.
Create a common provider interface.
At minimum implement:
-  MockExtractionProvider 
-  OpenAIExtractionProvider adapter 
-  AnthropicExtractionProvider adapter 
The mock provider must require no external API key and return deterministic structured data based on the document and schema.
The OpenAI and Anthropic implementations can remain optional based on environment configuration, but their provider architecture and real integration boundaries should exist.
Never store API secrets in the database.
A user can select:
-  one dataset or specific documents 
-  schema 
-  provider 
-  model/configuration 
and start an asynchronous extraction run.
Track:
-  queued 
-  running 
-  completed 
-  partially_failed 
-  failed 
-  cancelled 
One failed document must not fail an entire dataset run.
Store per-document:
-  structured output 
-  raw provider response 
-  latency 
-  model/provider 
-  token usage 
-  estimated cost 
-  error information 
Use Redis and Celery.
Implement real jobs for:
-  preprocessing 
-  extraction 
-  schema validation 
-  evaluation 
-  webhook delivery 
Add retry behavior for transient failures such as rate limiting and timeouts.
Do not retry permanent errors such as invalid schemas or missing files.
Provider responses should go through a normalization layer before validation.
Handle:
-  JSON wrapped in markdown code fences 
-  malformed JSON errors 
-  numeric strings 
-  null values 
-  nested wrapper objects 
-  warnings 
Never silently discard malformed data.
Preserve the raw provider response.
Every extraction result must be validated against the selected schema.
Validation errors must include:
-  JSON path 
-  validator/type 
-  expected value/type 
-  received value/type when available 
-  readable error message 
Users can provide trusted expected JSON for a document.
Support:
-  manual ground truth entry 
-  editing 
-  importing 
-  promoting an extraction result to ground truth 
Changes to ground truth should be audited.
Compare extraction results against ground truth recursively.
Support:
-  exact field match 
-  normalized strings 
-  numeric tolerance 
-  nested objects 
-  arrays 
-  missing fields 
-  extra fields 
For arrays support both:
-  ordered comparison 
-  order-insensitive comparison 
Calculate useful metrics such as:
-  matched fields 
-  total fields 
-  precision 
-  recall 
-  F1 where appropriate 
-  overall score 
Create a side-by-side JSON comparison screen.
Show:
-  ground truth 
-  extracted JSON 
-  matching fields 
-  changed fields 
-  missing fields 
-  extra fields 
-  type mismatches 
Nested JSON should be expandable/collapsible.
Users should be able to compare multiple extraction runs.
Show per provider/model:
-  success rate 
-  schema validity rate 
-  average evaluation score 
-  average latency 
-  p50 latency 
-  p95 latency 
-  total estimated cost 
-  cost per document 
-  failure count 
Implement aggregated backend metric endpoints rather than calculating everything in the frontend.
Include:
-  extraction volume 
-  success/failure rate 
-  schema validation rate 
-  evaluation score 
-  provider latency 
-  estimated cost 
-  MIME type breakdown 
-  errors by category 
Track meaningful actions including:
-  project creation/update 
-  schema creation/versioning 
-  document upload/delete 
-  extraction start/cancel 
-  ground truth changes 
-  provider configuration changes 
Provide filtering by:
-  action 
-  entity 
-  date 
-  user 
Projects can configure outbound webhooks for:
-  run.completed 
-  run.failed 
-  extraction.failed 
Webhook payloads must be signed using HMAC SHA-256.
Store delivery attempts and retry failed requests.
Support exporting results as:
-  JSON 
-  JSONL 
-  CSV 
CSV should flatten nested JSON using dot notation.
Implement local email/password authentication.
Support:
-  register 
-  login 
-  logout 
-  current user 
Use secure password hashing.
Use JWT or secure HTTP-only cookies.
Design the auth layer so OAuth/SSO could be added later without rewriting the application.
Build proper pages for:
-  Login/Register 
-  Projects 
-  Project dashboard 
-  Datasets 
-  Dataset detail 
-  Document detail 
-  Schemas 
-  Schema editor 
-  Runs 
-  Run detail 
-  Run comparison 
-  Metrics 
-  Audit log 
-  Settings 
Use:
-  sidebar navigation 
-  breadcrumbs 
-  metric cards 
-  tables 
-  filters 
-  status badges 
-  charts 
-  JSON viewer/editor 
-  dialogs 
-  loading states 
-  empty states 
-  failure states 
-  toast notifications 
Do not create giant page components. Organize frontend code by features.
Create a storage abstraction with:
-  LocalStorageBackend 
-  S3StorageBackend 
Required operations:
-  put 
-  get 
-  delete 
-  exists 
-  signed URL or equivalent access abstraction 
Local storage should be the default.
Use REST APIs with consistent response/error structures.
Typical routes:
```
/api/auth/*
/api/projects/*
/api/projects/{id}/schemas
/api/projects/{id}/datasets
/api/datasets/{id}/documents
/api/projects/{id}/runs
/api/runs/{id}
/api/results/{id}
/api/documents/{id}/ground-truth
/api/projects/{id}/metrics/*
/api/projects/{id}/audit
/api/projects/{id}/webhooks
```
Errors should use a consistent structure:
```
{
  "error": {
    "code": "DUPLICATE_DOCUMENT",
    "message": "This document already exists in the dataset.",
    "details": {}
  }
}
```
Use a structure similar to:
```
docintel-bench/
  backend/
    app/
      api/
      auth/
      core/
      db/
      models/
      schemas/
      services/
      providers/
      preprocessing/
      normalization/
      validation/
      evaluation/
      storage/
      jobs/
      metrics/
      audit/
      webhooks/
      exports/
      cli/
    tests/
    alembic/

  frontend/
    src/
      api/
      components/
      features/
      hooks/
      layouts/
      pages/
      routes/
      types/
      utils/

  docker/
  scripts/
  docker-compose.yml
  Makefile
  README.md
  .env.example
```
Do not create modules without meaningful functionality.
The entire application should start with:
```
cp .env.example .env
docker compose up --build
```
Expected services:
```
Frontend: http://localhost:3000
Backend:  http://localhost:8000
Swagger:  http://localhost:8000/docs
```
Provide:
```
make dev
make test
make lint
make migrate
make seed
make reset-db
```
Include seed data so the UI is useful immediately after startup.
Use:
-  strict TypeScript 
-  typed API models 
-  Pydantic request/response models 
-  service-layer business logic 
-  repository/data-access boundaries where appropriate 
-  database migrations 
-  structured logging 
-  request IDs 
-  useful error codes 
-  environment-based secrets 
- .env.example 
Never commit real API keys, passwords, AWS credentials, tokens, or webhook secrets.
Do not include copied proprietary code.
Do not inflate source-file or line counts through generated, duplicated, trivial, or filler code.
The project is complete when all of the following are true.
-  At least 50 meaningful first-party source files exist outside tests, generated code, dependencies, fixtures, migrations, and build output. 
-  At least 8,000 lines of meaningful first-party application source code exist across the frontend and backend. 
-  The LOC target must be reached through actual functionality, not whitespace, repetitive boilerplate, duplicated code, dummy functions, generated files, or artificial padding. 
-  The repository has a coherent architecture that could realistically be maintained by another engineer. 
-  Tests and documentation are additional to the production-source threshold. 
-  Development is performed incrementally rather than as one giant commit. 
-  Maintain at least 50 meaningful commits across development. 
-  Commit messages describe actual changes. 
-  Do not manufacture empty commits purely to satisfy a count. 
-  The repository should demonstrate at least two weeks of genuine development history before it is considered finished. 
-  Do not rewrite timestamps or fabricate historical development activity. 
- docker compose up --build starts the full local application successfully. 
-  Frontend, API, worker, PostgreSQL, and Redis communicate correctly. 
-  A user can register and log in. 
-  A user can create a project. 
-  A user can create/version an extraction schema. 
-  A user can create a dataset. 
-  A user can upload supported PDFs/images. 
-  Duplicate files are detected. 
-  Documents can be preprocessed. 
-  The mock extraction provider works without credentials. 
-  A dataset extraction can be started asynchronously. 
-  Run progress and individual document status are visible. 
-  Extraction responses are normalized. 
-  Results are schema validated. 
-  Ground truth can be entered. 
-  Extraction results can be evaluated against ground truth. 
-  JSON differences are visible in the UI. 
-  Two runs can be compared. 
-  Metrics are displayed. 
-  Audit events are visible. 
-  Results can be exported. 
-  Webhooks can be configured and signed. 
-  Failed background work has appropriate retry/error handling. 
-  Database migrations work from an empty PostgreSQL database. 
-  API request and response bodies are typed. 
-  Business logic is not concentrated in API route handlers. 
-  Background jobs are idempotent where appropriate. 
-  Individual extraction failures do not incorrectly fail an entire batch. 
-  Error responses use stable machine-readable error codes. 
-  Health/readiness endpoints exist. 
-  Application logs contain request/run context without exposing credentials. 
-  TypeScript strict mode passes. 
-  Main workflows are usable without manually invoking APIs. 
-  UI includes loading, empty, validation-error, server-error, and success states. 
-  Long-running extraction jobs expose progress. 
-  JSON results and differences are readable. 
-  Metrics and comparisons work with seeded and newly-created data. 
-  Components are reasonably modular. 
Automated tests cover at minimum:
-  authentication 
-  project creation/update/archive 
-  schema creation/versioning/validation 
-  file upload validation 
-  duplicate detection 
-  mock extraction 
-  partial run failure 
-  normalization 
-  schema validation 
-  string evaluation 
-  numeric tolerance 
-  array comparison 
-  nested-object comparison 
-  storage operations 
-  webhook signing 
-  retry behavior 
-  major frontend forms and screens 
The complete automated test suite must pass.
-  No real credentials are committed. 
-  Uploaded filenames cannot cause path traversal. 
-  Unsupported uploads are rejected. 
-  API secrets are supplied only through environment variables or equivalent secret configuration. 
-  Sensitive headers and credentials are excluded from logs. 
-  Webhook payloads are signed. 
- .env is ignored by Git. 
- .env.example contains placeholder values only. 
The README explains:
-  purpose 
-  architecture 
-  local setup 
-  environment configuration 
-  database migrations 
-  worker/job architecture 
-  storage architecture 
-  provider architecture 
-  how to add another extraction provider 
-  how evaluation works 
-  how to run tests 
-  API documentation location 
-  security considerations 
Include a Mermaid architecture diagram.
The finished repository should look like a real engineering project that an experienced developer could clone, understand, run, extend, and review.