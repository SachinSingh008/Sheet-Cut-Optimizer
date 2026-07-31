Reports
Material report
Shows group-by material family, grade, thickness, quantities, total area/length, and total weight.

Project summary
Shows total parts, total merged parts, groups, sheets used, yield, cost range, and unresolved parsing issues.

Production summary
Shows released optimization jobs, layout counts, machine-ready groups, and priority packets.

Optimization summary
Shows algorithm mode, runtime, stock sizes compared, best scenario, yield, scrap, and remnant statistics.

Cost report
Shows material costs, scrap cost estimate, remnant credit estimate, and optional transport assumptions.

Waste analysis
Shows total scrap, reusable remnant candidates, waste by thickness, and repeated inefficiency patterns.

Yield analysis
Shows yield by group, by project, by sheet size, and by optimization strategy.

User interface design
Product design principles
The interface should behave like an industrial planning workbench rather than a consumer SaaS dashboard. It must prioritize dense information, clear hierarchy, fast workflows, keyboard efficiency, and confidence visibility.

Primary screens
Landing page
The landing page should explain value propositions: faster planning, lower scrap, structured BOM ingestion, and optimization-backed purchase recommendations. It should also show sample outputs and supported data formats.

Dashboard
The dashboard should display active projects, recent imports, unresolved review items, optimization success metrics, and organization-level waste trends.

Projects page
Projects page should provide project cards or rows with status, revision, total parts, groups, last run time, and current yield benchmark.

Upload page
This page should support drag-and-drop import, template downloads, column mapping, header detection, and validation preview.

Review and parse page
Users should inspect parsed rows, confidence scores, extracted dimensions, duplicate suggestions, and errors requiring correction.

Optimization screen
This is the core planning workspace. It should let users pick groups, define stock sizes, set kerf and rotation rules, compare scenarios, and start optimization jobs.

Visualization screen
Users should see a sheet canvas with interactive layouts, color-coded parts, labels, utilization indicators, and sheet-by-sheet navigation.

Reports page
This page should list generated reports, export types, release versions, and approval status.

Settings page
Settings should include organization defaults, unit preferences, stock catalogs, material synonym dictionaries, parser rules, and role permissions.

UX requirements
Dark mode for shop-floor and long-session usability.

Responsive support for tablets, though desktop remains primary.

Keyboard shortcuts for planners.

Toasts only for non-critical notifications; inline validation for critical issues.

Confidence and warnings visible before optimization.

Visualization
Interactive nesting visualization should include:

Zoom and pan for large sheets.

90-degree rotate toggle in simulation mode.

Drag only in manual adjustment mode.

Hover highlight for part metadata.

Color coding by material, batch, or duplicate family.

Part labels and mark numbers.

Waste area shading.

Export to PNG/PDF for sharing.

Visualization is not cosmetic. Interactive previews are part of decision-making because users need to trust the automated arrangement before procurement and production release.
autodesk

AI features roadmap
Near-term AI features
AI parser fallback for ambiguous descriptions.

AI OCR correction assistant for scanned tables.

AI anomaly detection for suspicious dimensions or quantities.

AI material synonym expansion from historical projects.

Mid-term AI features
AI purchase recommendation using historical yield and cost outcomes.

AI scrap prediction before full optimization.

AI production duration estimation by material and cut complexity.

AI revision-diff assistant comparing BOM revisions.

Long-term AI features
AI chat assistant for planners.

AI drawing understanding for BOM-less projects.

AI learning from previous projects to suggest best stock sizes.

AI quotation and costing copilot.

AI root-cause analysis of persistent waste patterns.

Recommended free tech stack
The requested stack is already strong. The best architecture is a TypeScript web client with a Python optimization and data-processing backend.

Frontend
Layer	Recommendation	Why
App framework	React + Vite + TypeScript	Fast developer UX, type safety, strong ecosystem.
UI styling	TailwindCSS + shadcn/ui	Rapid enterprise UI composition with controllable design system.
State	Zustand + React Query/TanStack Query	Clean local state plus server-state synchronization.
Tables	TanStack Table	Excellent for large tabular review screens.
Forms	React Hook Form + Zod	Strong validation and performance.
Visualization	Konva.js for sheet canvas, optional React Konva	Better fit than Fabric.js for custom industrial 2D canvas interactions.
Graph flows	React Flow	Useful for future pipeline and workflow views.
Motion	Framer Motion	Good for polished microinteractions, used lightly.
Charts	Recharts or Apache ECharts	ECharts is stronger for dense enterprise charts; Recharts is simpler.
Backend
Layer	Recommendation	Why
API	FastAPI	Strong typing, async support, OpenAPI generation, Python ecosystem fit.
Data processing	Pandas + Polars + NumPy	Pandas for compatibility, Polars for large-file speed, NumPy for numeric ops.
Validation	Pydantic	Strong schemas across API and workers.
Migrations	Alembic	Standard SQLAlchemy migration workflow.
ORM	SQLAlchemy 2.x	Mature, flexible, enterprise-capable.
Optimization	rectpack + custom heuristics	Open-source and aligned with rectangle-packing needs.
pypi
+1
OCR helper	Tesseract + OpenCV + PaddleOCR optional	Open-source OCR pipeline, only optional.
Excel	OpenPyXL + XlsxWriter	Read and styled export generation.
PDF	WeasyPrint or ReportLab	WeasyPrint is easier for HTML-to-PDF reporting.
CSV/analytics	DuckDB	Excellent for fast ad hoc querying and import staging.
Database and storage
Layer	Recommendation	Why
Primary DB	PostgreSQL	Best open-source default for SaaS and enterprise deployments.
Local mode	SQLite	Ideal for demos, pilots, and offline single-site mode.
Object storage	Supabase Storage or Cloudflare R2	Low-cost file storage for imports and exports.
Auth	Supabase Auth or Keycloak	Supabase for speed, Keycloak for enterprise control.
Infrastructure
Layer	Recommendation	Why
Hosting	Render/Railway for MVP, later Kubernetes	Quick deployment now, scalable later.
CDN/proxy	Cloudflare	Caching, WAF, SSL, basic rate controls.
Containers	Docker	Reproducible deployment.
CI/CD	GitHub Actions	Free-tier friendly automation.
Background workers	Celery or RQ with Redis	Async optimization and report generation.
Observability	Sentry + OpenTelemetry + Prometheus/Grafana later	Error tracking and performance insight.
Requested stack evaluation
React, Vite, TypeScript: excellent choice.

TailwindCSS, shadcn/ui: excellent for MVP and long term.

FastAPI, Python: excellent because optimization and parsing are Python-friendly.

PostgreSQL, SQLite: correct dual-mode strategy.

OpenCV, Pandas, NumPy, Polars: all useful; use Polars more heavily for large BOM imports.

OpenPyXL, DuckDB: strong choices.

Konva.js: preferred over Fabric.js for controlled custom canvas interactions in this product.

RectPack: strong MVP choice because it already supports MaxRects, Guillotine, and Skyline families.
pypi
+1

Pydantic, Alembic, Docker, GitHub Actions, Cloudflare, Supabase, Railway, Render: all appropriate.

Improvements to add
Add SQLAlchemy 2.x explicitly.

Add Redis for queues and caching.

Add React Query for async state.

Add Zod for client validation.

Add Playwright for end-to-end testing.

Add Ruff and Black for Python quality.

Add ESLint and Prettier for frontend quality.

Add MinIO compatibility abstraction if self-hosted storage becomes necessary.