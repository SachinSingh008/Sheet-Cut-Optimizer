System architecture
Architectural style
Use a modular monolith first, not microservices. The domain is complex, but an MVP will benefit from a single deployable backend with clear modules for auth, projects, imports, parsing, optimization, reporting, and integrations. Heavy tasks such as optimization and report generation should run in separate worker processes, not separate products.

High-level components




Core workflow diagram




Sequence diagram




Database design
Entity model overview
The schema should support tenancy later, but the MVP can start with organization-aware single-tenant assumptions. Every business object should include created/updated metadata and soft-delete capability where relevant.

Main tables
users
Column	Type	Notes
id	uuid pk	
organization_id	uuid fk	future multi-tenant ready
email	varchar unique	
password_hash	varchar nullable	nullable if external auth
full_name	varchar	
role	varchar	admin, planner, purchaser, viewer
is_active	boolean	
created_at	timestamptz	
updated_at	timestamptz	
projects
Column	Type	Notes
id	uuid pk	
organization_id	uuid fk	
code	varchar	project code
name	varchar	
customer_name	varchar	
revision	varchar	
status	varchar	draft, reviewing, optimized, released
unit_system	varchar	default mm
created_by	uuid fk users.id	
created_at	timestamptz	
updated_at	timestamptz	
imports
Column	Type	Notes
id	uuid pk	
project_id	uuid fk	
source_type	varchar	excel, csv, api, pdf_ocr
original_file_name	varchar	
storage_path	varchar	
import_status	varchar	uploaded, parsed, failed
row_count	int	
parsed_row_count	int	
created_by	uuid fk	
created_at	timestamptz	
import_rows
Column	Type	Notes
id	uuid pk	
import_id	uuid fk	
source_row_no	int	
raw_json	jsonb	original source fields
normalized_json	jsonb	canonical fields
parse_status	varchar	parsed, review_required, rejected
confidence	numeric(5,4)	
created_at	timestamptz	
materials
Column	Type	Notes
id	uuid pk	
organization_id	uuid fk	
family	varchar	plate, ismc, pipe
subtype	varchar	chequered, ss304, etc
grade	varchar	
density_kg_m3	numeric	for weight calc
rotation_default	boolean	
metadata_json	jsonb	
parts
Column	Type	Notes
id	uuid pk	
project_id	uuid fk	
import_row_id	uuid fk nullable	lineage
material_id	uuid fk nullable	normalized lookup
part_mark	varchar	
description_raw	text	
quantity	numeric	
thickness_mm	numeric	
width_mm	numeric	
length_mm	numeric	
profile_size	varchar nullable	
machine_group	varchar	plate_2d, profile_1d
rotation_allowed	boolean	
duplicate_group_key	varchar	
is_merged	boolean	
review_status	varchar	approved, pending
metadata_json	jsonb	
created_at	timestamptz	
updated_at	timestamptz	
part_sources
Tracks multiple source rows merged into one normalized part.

stock_sheets
Column	Type	Notes
id	uuid pk	
organization_id	uuid fk	
material_family	varchar	
material_subtype	varchar	
thickness_mm	numeric	
width_mm	numeric	
length_mm	numeric	
unit_cost	numeric	
unit_weight_kg	numeric	
supplier_name	varchar	
is_active	boolean	
metadata_json	jsonb	
optimization_jobs
Column	Type	Notes
id	uuid pk	
project_id	uuid fk	
group_key	varchar	
algorithm	varchar	maxrects_bssf, guillotine_bssf_sas
objective	varchar	min_cost, max_yield
config_json	jsonb	
status	varchar	queued, running, completed, failed
started_at	timestamptz	
finished_at	timestamptz	
created_by	uuid fk	
layouts
Column	Type	Notes
id	uuid pk	
optimization_job_id	uuid fk	
sheet_no	int	
stock_sheet_id	uuid fk nullable	
stock_width_mm	numeric	
stock_length_mm	numeric	
yield_pct	numeric	
scrap_area_mm2	numeric	
layout_json	jsonb	
preview_image_path	varchar nullable	
reports
Column	Type	Notes
id	uuid pk	
project_id	uuid fk	
optimization_job_id	uuid fk nullable	
report_type	varchar	summary, purchase_list, waste
file_format	varchar	xlsx, pdf, csv, json
storage_path	varchar	
status	varchar	queued, ready, failed
created_at	timestamptz	
settings
Stores organization-level parser rules, unit defaults, synonyms, and optimization preferences.

audit_logs
Stores actor, entity, action, before/after snapshots, timestamp, and request correlation id.

ER diagram




API design
API principles
REST-first with OpenAPI docs from FastAPI.

Clear resource-oriented naming.

Async job pattern for optimization and report generation.

Versioned base path such as /api/v1.

Auth APIs
Method	Endpoint	Purpose
POST	/auth/register	Create account
POST	/auth/login	Obtain JWT/session
POST	/auth/refresh	Refresh token
POST	/auth/logout	Invalidate session
GET	/auth/me	Current user profile
Project APIs
Method	Endpoint	Purpose
GET	/projects	List projects
POST	/projects	Create project
GET	/projects/{id}	Get project
PATCH	/projects/{id}	Update project
DELETE	/projects/{id}	Archive project
Import APIs
Method	Endpoint	Purpose
POST	/projects/{id}/imports	Upload file or import payload
GET	/imports/{id}	Import summary
GET	/imports/{id}/rows	List parsed rows
POST	/imports/{id}/map-columns	Save column mapping
POST	/imports/{id}/reparse	Re-run parser
POST	/imports/{id}/approve	Approve reviewed data
Part APIs
Method	Endpoint	Purpose
GET	/projects/{id}/parts	List normalized parts
PATCH	/parts/{id}	Correct part data
POST	/projects/{id}/parts/merge	Merge duplicates
GET	/projects/{id}/groups	Material groups
Optimization APIs
Method	Endpoint	Purpose
POST	/projects/{id}/optimization-jobs	Start optimization
GET	/optimization-jobs/{id}	Job status
GET	/optimization-jobs/{id}/layouts	Layout results
POST	/optimization-jobs/{id}/rerun	Re-run with new config
POST	/optimization-jobs/{id}/compare-stock	Compare stock scenarios
Report/export APIs
Method	Endpoint	Purpose
POST	/projects/{id}/reports	Generate report set
GET	/reports/{id}	Report metadata
GET	/reports/{id}/download	Download artifact
GET	/projects/{id}/exports/json	API-style export
Settings APIs
Method	Endpoint	Purpose
GET	/settings/material-synonyms	Read synonyms
PUT	/settings/material-synonyms	Update synonyms
GET	/settings/stock-sheets	List stock catalog
POST	/settings/stock-sheets	Add stock sheet
PUT	/settings/optimization-defaults	Update defaults
Folder structure
text

steelnest-ai/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── projects/
│   │   │   │   ├── imports/
│   │   │   │   ├── parts/
│   │   │   │   ├── optimization/
│   │   │   │   ├── layouts/
│   │   │   │   ├── reports/
│   │   │   │   └── settings/
│   │   │   ├── lib/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── types/
│   │   │   └── styles/
│   │   └── public/
│   ├── api/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── core/
│   │   │   ├── models/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── parsers/
│   │   │   ├── optimizers/
│   │   │   ├── reports/
│   │   │   ├── workers/
│   │   │   └── integrations/
│   │   ├── alembic/
│   │   └── tests/
├── packages/
│   ├── shared-types/
│   ├── ui/
│   └── eslint-config/
├── infra/
│   ├── docker/
│   ├── github-actions/
│   └── terraform/  # future
├── scripts/
├── docs/
│   ├── product/
│   ├── architecture/
│   ├── api/
│   └── runbooks/
└── output/
Security
Authentication
Use JWT or Supabase session tokens for MVP, with refresh token support. Enterprise editions should support SSO through SAML/OIDC.

Authorization
Implement RBAC with roles such as admin, planner, purchaser, reviewer, and viewer. Object-level checks must validate project ownership or organization membership.

Validation
All payloads should use Pydantic on the backend and Zod on the frontend. File imports must validate MIME, extension, file size, and row limits.

Rate limiting
Apply API rate limiting per IP and per authenticated user at the edge and app layers.

SQL injection and query safety
Use ORM parameterization only. Never interpolate SQL from user-controlled inputs.

File upload validation
Permit only configured file types.

Virus-scan files in enterprise deployments.

Reject oversized or malformed spreadsheets.

Store uploads in object storage with randomized paths.

Never execute uploaded content.

Auditability
Every import, edit, optimization run, report generation, and release action should emit audit logs.

Performance and scalability
Caching
Cache material dictionaries, stock catalogs, and report metadata. Avoid caching highly project-specific optimization results unless keyed by exact config hash.

Background workers
Optimization and report generation must be asynchronous because larger jobs can take seconds to minutes.

Large Excel processing
Use streaming reads where possible, isolate staging from canonical writes, and prefer Polars/DuckDB for large transformations.

Streaming
For large exports and large row review pages, support pagination and streaming responses.

Optimization queue
Queue jobs by organization and priority. Enforce concurrency controls so one tenant cannot starve the system.

Observability
Track:

import duration,

parsing confidence distribution,

optimization runtime,

yield distribution,

failure rate,

report generation time,

worker queue depth.

MVP definition
What must be built first
The MVP should focus on one clear user promise: Upload a structured BOM, automatically normalize and group plate parts, compare stock sheet options, generate optimized 2D plate layouts, and export production and purchase reports.

MVP feature set
User authentication.

Project management.

Excel/CSV/manual import.

Column mapping.

Regex-first parsing for plate and a few profile families.

Confidence scoring and review queue.

Duplicate merge.

Material grouping by thickness and subtype.

Stock sheet input and comparison.

2D plate optimization using rectpack MaxRects default mode.
deepwiki

Layout visualization.

Excel/PDF/CSV/JSON outputs.

Audit logs.

What to defer
Full CAD native parsing.

Advanced OCR.

CNC/DXF export.

Full ERP integration.

Remnant inventory reuse optimization.

AI chat copilot.

Multi-factory scheduling.

Roadmap
Phase 1: foundation and BOM workflow
Duration: 6-8 weeks.

Features: authentication, project setup, imports, column mapping, normalization, parser v1, review queue.

Milestones: first successful project ingest from Excel/CSV; parsable plate BOM; saved normalized parts.

Deliverables: working web app with import-to-reviewed-parts flow.

Risks: ambiguous customer data formats, uncontrolled synonyms, parser overfitting.

Phase 2: optimization MVP
Duration: 6-8 weeks.

Features: stock sheet catalog, optimization job engine, rectpack integration, basic purchase comparison, layout viewer, report generation.

Milestones: first end-to-end optimized project; downloadable purchase list and cut layout.

Deliverables: MVP-ready optimization product.

Risks: algorithm edge cases, visualization complexity, slow jobs on large datasets.

Phase 3: enterprise hardening
Duration: 5-7 weeks.

Features: RBAC, audit logs, advanced settings, job queue, retries, monitoring, improved exports, versioned releases.

Milestones: multi-user pilot in real fabrication environment.

Deliverables: pilot-grade SaaS or on-prem deployment.

Risks: concurrency bugs, permissions drift, operational observability gaps.

Phase 4: integrations and inventory
Duration: 8-10 weeks.

Features: ERP import adapters, supplier stock catalogs, remnant tracking, profile 1D optimization expansion, API tokens.

Milestones: connected planning workflow with procurement support.

Deliverables: business-system-integrated planner.

Risks: integration heterogeneity, messy upstream data, remnant accounting complexity.

Phase 5: AI and advanced manufacturing intelligence
Duration: 10-14 weeks.

Features: AI parser enhancement, OCR helper, cost prediction, scrap prediction, AI assistant, drawing understanding experiments.

Milestones: AI-assisted review and recommendation layer.

Deliverables: differentiated intelligent fabrication platform.

Risks: model hallucination, trust issues, compute cost, evaluation difficulty.

Future features
Cloud SaaS multi-tenant deployment.

ERP integration with SAP, Tally, and custom systems.

CAD integration with Tekla, SolidWorks, AutoCAD exports.
sigmanest
+1

AI assistant for planners.

Quotation generator.

Cost estimation.

Inventory and remnant management.

Production planning.

Barcode and QR-code based traceability.
strumis

Machine integration.

CNC integration.

IoT telemetry for material usage feedback.

Coding standards
Naming conventions
Folders: lowercase-kebab-case for docs and infra, lowercase_snake_case for Python packages, kebab-case or feature folders in frontend depending on framework norms.

React components: PascalCase.

Hooks: useXyz.

API routes: plural nouns, resource-oriented.

Database tables: snake_case plural.

Git strategy
main: production.

develop: integration branch if team size warrants.

Feature branches: feat/<module>-<short-name>.

Fix branches: fix/<issue>.

Release branches optional for enterprise cadence.

Commit messages
Use Conventional Commits:

feat: add stock comparison endpoint

fix: correct plate parser width-length swap

refactor: isolate optimization job service

test: add import normalization cases

docs: update API contract for reports

Documentation style
ADRs for architectural decisions.

Markdown docs in /docs.

OpenAPI-generated API docs.

Inline code comments only where business rules are non-obvious.

Testing strategy
Unit tests for parsers, validators, calculators.

Property-based tests for parsing edge cases.

Integration tests for imports, optimization API, reports.

End-to-end tests for critical user flows with Playwright.

Golden snapshot tests for report outputs.

Performance tests for large BOM imports and large optimization jobs.

Implementation guide for Cursor AI
The following task breakdown is designed so that Cursor AI or a human engineering team can build the system incrementally. Tasks are intentionally small, explicit, and dependency-aware.

Task legend
Priority: P0 critical, P1 important, P2 later.

Development tasks 001-120
Task	Objective	Files to create	Files to modify	Expected output	Acceptance criteria	Dependencies	Priority	Est. time
001	Initialize monorepo structure	root folders, README.md	none	Repo skeleton	App folders exist and lint commands documented	none	P0	2h
002	Initialize frontend app with Vite React TS	apps/web/*	package.json	Running frontend	pnpm dev starts web app	001	P0	2h
003	Initialize backend FastAPI app	apps/api/*	pyproject.toml	Running API	/health returns 200	001	P0	2h
004	Add Dockerfiles for web and api	infra/docker/*	README.md	Container builds	docker build passes	002,003	P1	3h
005	Set up GitHub Actions for lint/test	.github/workflows/*	none	CI pipeline	CI runs on push	002,003	P1	3h
006	Add shared env config templates	.env.example files	README.md	Config template	Required variables documented	002,003	P0	1h
007	Install Tailwind and shadcn/ui	frontend styling files	web app config	Base design system	Tailwind styles render	002	P0	3h
008	Add ESLint/Prettier frontend config	config files	package.json	Linting ready	Lint command passes	002	P0	2h
009	Add Ruff/Black/mypy backend config	config files	pyproject.toml	Python quality tools	Lint/type commands pass	003	P0	2h
010	Configure SQLAlchemy, Alembic, Pydantic settings	backend core files	pyproject	DB base layer	App boots with settings	003	P0	3h
011	Create PostgreSQL docker-compose for local dev	docker-compose.yml	README.md	Local DB stack	DB starts locally	010	P0	2h
012	Add auth domain schemas	backend schemas/auth	none	Auth models	Schema tests pass	010	P0	2h
013	Add user ORM model	backend models/user.py	model init	User table model	Alembic autogen sees table	010	P0	2h
014	Create initial migration	alembic versions	none	Migration file	Migration applies cleanly	013	P0	2h
015	Build password hashing utilities	backend core/security.py	none	Hash helpers	Hash/verify tests pass	012	P0	1h
016	Implement register endpoint	auth router/service	app router init	User signup	API creates user	012,013,015	P0	3h
017	Implement login endpoint	auth router/service	security config	JWT login	Token returned for valid credentials	016	P0	3h
018	Implement current-user endpoint	auth dependencies	router init	/auth/me	Authenticated user profile returned	017	P0	2h
019	Create frontend auth pages	web auth pages	route config	Login/register UI	User can sign in	016,017	P0	4h
020	Add protected route wrapper	web routing utilities	app routes	Protected screens	Unauth access redirects	019	P0	2h
021	Create project ORM model	backend models/project.py	model init	Project table	Migration autogen works	010	P0	2h
022	Create project schemas and CRUD service	backend schemas/projects	router init	Project service	CRUD unit tests pass	021	P0	3h
023	Add project APIs	backend api/projects.py	app router	Project endpoints	CRUD endpoints functional	022	P0	3h
024	Build frontend dashboard shell	web layout components	route config	App shell	Sidebar/header render	007,020	P0	4h
025	Build projects list page	web features/projects	nav config	Project list UI	Projects load from API	023,024	P0	4h
026	Build create-project modal/form	web features/projects	page hooks	Project creation UI	New project persists	025	P0	3h
027	Create import ORM model	backend models/import.py	model init	Imports table	Migration works	010,021	P0	2h
028	Create import row ORM model	backend models/import_row.py	model init	Import rows table	Migration works	027	P0	2h
029	Add object storage abstraction	backend services/storage.py	settings	Upload layer	Local and cloud adapters stubbed	027	P0	3h
030	Build file upload endpoint	backend api/imports.py	routers	Upload API	File saved and import record created	027,029	P0	4h
031	Build upload page UI	web features/imports	routes	Upload screen	File uploads from browser	030	P0	4h
032	Add Excel/CSV reader service	backend services/import_reader.py	requirements	Tabular reader	Reads sheets and headers	030	P0	4h
033	Persist raw import rows	backend import service	api/imports	Raw rows stored	Row count matches source	028,032	P0	3h
034	Add column mapping schema	backend schemas/import_mapping.py	none	Mapping contract	Schema validation passes	032	P0	2h
035	Implement column mapping endpoint	backend api/imports.py	import service	Save mappings	User mapping persisted	034	P0	3h
036	Build column mapping UI	web features/imports/mapping	upload flow	Mapping screen	Headers can be mapped	035	P0	5h
037	Create canonical row schema	backend schemas/canonical_part.py	none	Canonical model	Validation tests pass	034	P0	2h
038	Implement row normalization service	backend services/normalizer.py	import pipeline	Normalized rows	Raw to canonical conversion works	037	P0	4h
039	Add parser package structure	backend parsers/*	none	Parser module layout	Imports resolve cleanly	038	P0	1h
040	Implement plate regex parser	backend parsers/plate.py	parser init	Plate parsing	Example patterns parse correctly	039	P0	4h
041	Implement ISMC regex parser	backend parsers/ismc.py	parser init	ISMC parsing	Example patterns parse correctly	039	P1	3h
042	Implement ISMB regex parser	backend parsers/ismb.py	parser init	ISMB parsing	Example patterns parse correctly	039	P1	3h
043	Build parser orchestrator	backend parsers/orchestrator.py	services	Family dispatch	Routes rows to correct parser	040,041,042	P0	4h
044	Add confidence scoring utility	backend parsers/confidence.py	orchestrator	Confidence scores	Score bands tested	043	P0	3h
045	Normalize material synonyms	backend services/material_normalizer.py	settings seed	Standard material names	Synonym tests pass	038	P0	3h
046	Create parts ORM model	backend models/part.py	model init	Parts table	Migration works	010,021	P0	2h
047	Create part_sources ORM model	backend models/part_source.py	model init	Lineage table	Migration works	046	P1	2h
048	Persist parsed parts pipeline	backend services/part_builder.py	import flow	Parts created	Parsed rows become parts	043,044,046	P0	4h
049	Add review status and parse issue fields	migration files	models	Review metadata	Ambiguous rows can be flagged	048	P0	2h
050	Build parsed rows review API	backend api/parts.py	services	Review endpoints	Rows can be listed/filtered by status	048,049	P0	3h
051	Build review queue UI table	web features/parts/review	routes	Review screen	Low-confidence rows visible	050	P0	5h
052	Build inline part edit form	web features/parts/edit	review page	Edit modal	User can correct parsed rows	051	P0	4h
053	Implement approve/correct endpoints	backend api/parts.py	service layer	Approval flow	Edited rows can be approved	050	P0	3h
054	Create duplicate detection service	backend services/duplicate_detector.py	part builder	Duplicate groups	Similar parts grouped	048	P0	4h
055	Implement quantity merge logic	backend services/merge_parts.py	parts API	Merged parts	Quantities aggregate correctly	054	P0	3h
056	Build duplicate review UI	web features/parts/duplicates	review screens	Duplicate screen	User sees suggested merges	055	P1	4h
057	Create materials ORM model	backend models/material.py	model init	Materials table	Migration works	010	P1	2h
058	Build material resolution service	backend services/material_resolver.py	parsers	Parts linked to materials	Known families resolve	045,057	P1	3h
059	Add stock_sheets ORM model	backend models/stock_sheet.py	model init	Stock table	Migration works	010	P0	2h
060	Build stock sheet CRUD APIs	backend api/settings_stock.py	settings service	Stock catalog API	CRUD works	059	P0	3h
061	Build stock catalog settings UI	web features/settings/stock	routes	Stock settings page	User manages stock sizes	060	P0	4h
062	Implement material grouping service	backend services/grouping.py	parts API	Group summaries	Parts grouped by optimizer key	055,058	P0	3h
063	Create optimization_job ORM model	backend models/optimization_job.py	model init	Job table	Migration works	010,021	P0	2h
064	Create layout ORM model	backend models/layout.py	model init	Layout table	Migration works	063	P0	2h
065	Add report ORM model	backend models/report.py	model init	Reports table	Migration works	063	P1	2h
066	Add Redis and worker bootstrap	backend workers/*	infra files	Queue framework	Worker process starts	003	P0	4h
067	Create optimization config schemas	backend schemas/optimization.py	none	Config contract	Validation tests pass	063	P0	3h
068	Add rectpack dependency and wrapper	backend optimizers/rectpack_engine.py	requirements	Packer wrapper	Simple packing test works	067	P0	5h
069	Implement MaxRects default strategy	backend optimizers/maxrects.py	wrapper	MaxRects job	Pack sample plates successfully	068	P0	4h
070	Implement guillotine strategy option	backend optimizers/guillotine.py	wrapper	Alternate strategy	Guillotine mode selectable	068	P1	4h
071	Build layout serializer	backend optimizers/serializer.py	layout model service	Layout JSON output	Serialized coordinates saved	069	P0	3h
072	Build optimization job service	backend services/optimization_jobs.py	api	Queue jobs	Jobs can be created	063,067,069	P0	4h
073	Implement worker execution flow	backend workers/optimization_worker.py	services	Async optimization	Queued jobs complete	066,072	P0	5h
074	Add optimization status endpoint	backend api/optimization.py	router init	Job status API	Job polling works	072	P0	2h
075	Build optimization setup UI	web features/optimization/setup	routes	Optimization form	User configures stock and rules	061,074	P0	5h
076	Build job status and results UI	web features/optimization/jobs	setup flow	Progress UI	User sees running/completed jobs	074,075	P0	4h
077	Implement stock scenario comparison service	backend services/stock_compare.py	optimization service	Ranked scenarios	Options compare by yield and cost	060,062,069	P0	5h
078	Add stock comparison endpoint	backend api/optimization.py	services	Comparison API	Scenario list returns	077	P0	2h
079	Build scenario comparison UI	web features/optimization/compare	setup page	Comparison table	User can compare stock sizes	078	P0	4h
080	Create visualization canvas foundation	web features/layouts/canvas	routes	Canvas component	Sheet renders to screen	076	P0	5h
081	Render parts rectangles on canvas	layout components	canvas foundation	Layout preview	Parts visible in correct positions	071,080	P0	4h
082	Add zoom and pan support	canvas hooks	canvas components	Interactive viewer	Zoom/pan works smoothly	081	P0	3h
083	Add part hover tooltips and labels	canvas components	layout UI	Metadata viewer	Hover shows part info	081	P0	3h
084	Add sheet navigation and summary sidebar	layout screens	routes	Multi-sheet viewer	User can switch sheets	081	P0	4h
085	Add color coding modes	canvas components	settings	Display modes	Color by material/batch works	083	P1	3h
086	Build export image from canvas	frontend export util	layout page	PNG export	User downloads sheet image	084	P1	4h
087	Build report generation service base	backend reports/base.py	worker init	Report framework	Report jobs can run	065,066	P0	4h
088	Generate project summary JSON	backend reports/project_summary.py	report service	JSON summary	Correct metrics emitted	087	P0	3h
089	Generate CSV part and layout exports	backend reports/csv_exports.py	report service	CSV outputs	CSV downloads valid	087	P0	3h
090	Generate Excel workbook export	backend reports/xlsx_export.py	report service	XLSX report	Workbook opens correctly	087	P0	5h
091	Generate PDF summary export	backend reports/pdf_export.py	templates	PDF report	PDF renders cleanly	087	P0	5h
092	Add report generation endpoint	backend api/reports.py	routers	Report API	User can request reports	087	P0	3h
093	Build reports page UI	web features/reports	routes	Reports screen	Available files listed	092	P0	4h
094	Add downloadable artifact links	web utilities	reports page	Download flow	Exports download successfully	093	P0	2h
095	Create settings store for parser defaults	frontend settings store	settings pages	Settings state	Defaults persist in UI	061	P1	3h
096	Add settings table for material synonyms	backend settings APIs	settings models	Synonym mgmt	Synonyms editable	045	P1	3h
097	Build material synonym UI	web settings	settings page	Synonym editor	User edits mappings	096	P1	4h
098	Implement audit_logs ORM model	backend models/audit_log.py	model init	Audit table	Migration works	010	P1	2h
099	Add audit logging middleware/service	backend core/audit.py	routers/services	Audit capture	Key actions logged	098	P1	4h
100	Build audit log admin API	backend api/audit.py	router init	Audit endpoint	Logs queryable	099	P2	2h
101	Add dashboard metrics endpoint	backend api/dashboard.py	services	Dashboard data	KPI payload returns	023,063,065	P1	3h
102	Build dashboard KPI cards	web dashboard widgets	dashboard page	Metrics UI	KPIs render from API	101	P1	3h
103	Build unresolved issues widget	dashboard widgets	page	Ops widget	Review backlog visible	050,101	P1	2h
104	Build recent jobs widget	dashboard widgets	page	Job summary	Completed jobs listed	074,101	P1	2h
105	Add unit conversion utility	backend utils/units.py	normalizer	Unit conversions	inch/mm conversions tested	038	P1	2h
106	Add dimension validation rules	backend validators/dimensions.py	parser pipeline	Validation engine	Invalid dimensions flagged	038,044	P0	3h
107	Add rotation policy support per part	models/schemas migration	parser/orchestrator	Rotation metadata	Part policies persist	040,058	P0	3h
108	Apply kerf and margin config in optimizer	optimizer config	maxrects/guillotine	Realistic nesting	Utilization accounts for allowances	067,069	P0	4h
109	Add optimization objective selector	backend schema/frontend form	optimization screens	Objective choice	User picks objective	075,077	P1	3h
110	Build release/approval workflow	backend project state APIs	frontend actions	Release action	Only approved jobs release	053,092	P1	4h
111	Add role-based access controls	backend authz layer	frontend guards	RBAC	Restricted routes enforced	018,023	P1	5h
112	Add end-to-end Playwright tests	e2e tests	CI config	Browser tests	Critical flow passes in CI	025,031,051,075	P1	6h
113	Add parser unit fixture suite	tests/parsers/*	none	Parser test coverage	Core patterns covered	040,041,042	P0	4h
114	Add import integration tests	tests/imports/*	none	Import coverage	Excel/CSV imports pass	032,035,038	P0	4h
115	Add optimization golden tests	tests/optimizers/*	sample data	Stable layouts	Known samples produce expected metrics	069,108	P0	5h
116	Add report snapshot tests	tests/reports/*	sample fixtures	Export stability	Output snapshots pass	088,089,090,091	P1	4h
117	Add OCR helper service stub	backend integrations/ocr.py	import APIs	Optional OCR module	Stub endpoint exists behind feature flag	030	P2	3h
118	Add AI parser adapter stub	backend integrations/ai_parser.py	parser orchestrator	Fallback hook	Low-confidence rows can call stub	043,044	P2	3h
119	Write architecture and runbook docs	docs/*	README.md	Engineering docs	Setup and architecture documented	001-117	P1	6h
120	Prepare pilot deployment configuration	infra deployment files	docs/runbooks	Deployable MVP	Staging deploy successful	004,005,111	P1	5h
Additional implementation guidance for Cursor AI
Build order recommendation
Cursor AI should implement the system in vertical slices, not by dumping all files at once. The safest build sequence is:

Foundation and auth.

Projects and app shell.

Upload and import persistence.

Column mapping and normalization.

Parsing and review queue.

Duplicate merge and grouping.

Stock catalog and optimization.

Visualization.

Reports and release flow.

Hardening, RBAC, tests, and deployment.

Prompting strategy for Cursor AI
For each task, provide Cursor AI with:

exact objective,

file list,

interface contracts,

sample payloads,

acceptance criteria,

constraints such as “do not refactor unrelated modules.”

Example Cursor task prompt
text

Task 068: Add rectpack dependency and wrapper.
Objective: Create a Python service that converts normalized plate parts and stock sheet definitions into rectpack inputs and returns serialized placements.
Files to create: apps/api/app/optimizers/rectpack_engine.py, apps/api/app/schemas/optimization_result.py, tests/optimizers/test_rectpack_engine.py
Files to modify: apps/api/pyproject.toml
Expected output: A service function pack_rectangles(parts, bins, config) -> placements.
Acceptance criteria: Handles rotation flag, returns deterministic result for fixture data, tests pass.
Dependencies: Tasks 067 and prior optimization schemas.
Guardrails for AI-assisted coding
Keep domain rules in pure functions where possible.

Keep parser regex tables data-driven.

Keep optimization service stateless except for persistence orchestration.

Write tests with every parser and optimizer change.

Preserve audit trails and source lineage.

Never let AI fallback parsing bypass validation.

Product decisions and recommendations
MVP recommendation
Build a BOM-first, OCR-optional, plate-focused optimizer with strong review, grouping, and reporting. This gives the fastest path to real value and avoids the trap of overinvesting in unreliable scan interpretation.
autodesk
+2

Long-term recommendation
Evolve toward a fabrication planning platform that combines optimization, procurement intelligence, remnant reuse, cost analytics, workflow integration, and AI assistance. Market leaders in this space already emphasize the convergence of nesting, quoting, inventory, scheduling, and machine readiness, validating this direction.
strumis
+1

Final architectural recommendation
Use a modular monolith with FastAPI, PostgreSQL, worker queues, and a React/TypeScript frontend; use regex-first structured parsing with optional AI fallback; use rectpack-backed MaxRects as the default plate optimization engine; and treat OCR as a sidecar helper rather than a core dependency.