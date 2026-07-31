End-to-end workflow
Stage 1: project creation
A user creates a project, selects business unit, customer, project code, drawing package revision, measurement units, and default optimization preferences.

Stage 2: data ingestion
The user imports structured files such as Excel, CSV, ERP export, AutoCAD BOM, Tekla BOM, SolidWorks BOM, or enters data manually. The ingestion pipeline should preserve the raw file, parse sheets/tables, map columns, and create an import session with traceability metadata.

Stage 3: table extraction and mapping
For Excel/CSV, the system reads headers and suggests mappings such as part mark, description, quantity, material, thickness, length, width, weight, drawing number, and remarks. For PDF or images, OCR and table extraction exist only as helper flows, never as the main route.

Stage 4: normalization
The system standardizes units, trims whitespace, removes illegal characters, converts dimensions to canonical numeric fields, normalizes material names, and stores both raw and normalized representations for auditability.

Stage 5: description parsing
The parser inspects fields like description, material code, remarks, and section strings to derive type, thickness, width, length, profile size, grade, and orientation hints. Regex rules should run first because they are deterministic and auditable; an AI parser should only handle unmatched or low-confidence rows.

Stage 6: duplicate and quantity merge
Items sharing the same manufacturable identity—material family, thickness, dimensions, profile size, grade, edge condition, and machine-relevant attributes—are merged into aggregate quantities while keeping source lineage.

Stage 7: material grouping
Parts are grouped into optimization buckets such as plate thickness groups, chequered plate groups, stainless groups, ISMC groups, ISMB groups, pipe groups, flats, angles, and round bars. This step determines which optimization engine and constraints apply.

Stage 8: stock definition
The user provides available stock sizes, either from settings, supplier catalog, inventory import, or manual entry. The system attaches cost, weight, preferred suppliers, transport assumptions, and remnant policies.

Stage 9: optimization
The optimization engine runs 2D nesting for plates and 1D cutting for bars/profiles, respecting rotation permissions, edge margins, kerf, trim loss, grain or pattern constraints, forbidden orientations, common-line options, and max runtime.

Stage 10: visualization and review
Users inspect interactive layouts, zoom into sheets, rotate views, highlight part labels, inspect waste zones, and review utilization metrics. Interactive preview is a core expectation of nesting software because it lets users validate machine-feasible layouts and business trade-offs before release.
autodesk

Stage 11: reporting and export
The platform generates cut layouts, purchase summaries, scrap reports, thickness summaries, material summaries, production packets, and structured exports in Excel, CSV, JSON, and PDF. Future DXF/CNC outputs should use this stage as the release boundary.

Stage 12: approval and handoff
Approved jobs move into a released state, locking reports and publishing outputs to downstream systems such as ERP, inventory, or shop-floor execution.

Why OCR must be optional
OCR should not be the architectural backbone because fabrication drawings often have noisy scans, mixed fonts, skewed tables, dimension symbols, and handwritten annotations that reduce extraction accuracy. Nesting software value comes from reliable structured geometry and metadata, not from best-effort recovery of low-quality drawings. The strongest commercial positioning in this category centers on import from design systems, CAD/BIM, material lists, business systems, and digital workflows rather than OCR-first data capture.
autodesk
+2

A digital-first ingestion model has several advantages:

It produces higher precision for dimensions and quantities than scan-based inference.

It is easier to validate and audit because source rows can be traced back to exact digital fields.

It supports repeatable automation across ERP exports and CAD-generated BOM formats.
strumis
+1

It keeps the optimization engine independent from document-quality variance.

It allows OCR to be added as a bounded helper module for exception cases rather than contaminating the core data pipeline.

Recommended architecture: treat OCR as a sidecar service that converts PDF or image tables into a provisional dataset, assigns low default confidence, and routes everything through the same normalization and validation pipeline used by Excel or CSV inputs.