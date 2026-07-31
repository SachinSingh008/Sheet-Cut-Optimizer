Data inputs
Supported input types
Input type	MVP support	Notes
Excel (.xlsx, .xls)	Yes	Primary input for planners and BOM exports.
CSV	Yes	Lightweight and ERP-friendly.
Manual entry	Yes	Useful for pilots and small jobs.
JSON/API	Yes	Supports integrations and automation.
ERP export	Yes	SAP/Tally/custom ERP adapters should map to canonical import schema.
AutoCAD BOM	Yes	Via exported table formats, not direct DWG parsing in MVP.
SolidWorks BOM	Yes	Via Excel/CSV export in MVP.
Tekla BOM	Yes	Via report export in MVP.
PDF	Partial	Table extraction/OCR helper only.
Image	Partial	OCR helper only.



Canonical import model
Every ingestion source should be mapped into a canonical row structure:

json

{
  "source_row_id": "raw-00123",
  "part_mark": "P-101",
  "description": "PL 6 THK 200 x 300",
  "quantity": 4,
  "material_grade": "MS",
  "unit": "mm",
  "drawing_no": "A-102",
  "remarks": "",
  "raw_fields": {"...": "..."}
}
This canonical model makes downstream parsing source-agnostic.

Data extraction and parsing
Parsing strategy
Description parsing should use a layered approach:

Deterministic regex parser.

Rule engine with token dictionaries and unit normalization.

AI parser for unresolved or low-confidence patterns.

Human review queue for ambiguous rows.

Example parse rules
Raw description	Parsed type	Key extracted fields
PL 6 THK 200 x 300	Plate	thickness=6, width=200, length=300
CHQ.PL 6 THK 560 x 3200	Chequered Plate	thickness=6, width=560, length=3200
ISMC 150x75 1290 LG	ISMC	size=150x75, length=1290
ISMB 200x100 180 LG	ISMB	size=200x100, length=180
Regex philosophy
Regex should not aim to “understand fabrication” globally. It should extract constrained patterns from known families and hand off when confidence drops. Each material family gets its own pattern module.

Example patterns:

python

PLATE_RE = r"\b(?P<type>PL|PLATE|CHQ\.?PL)\b\s*(?P<thk>\d+(?:\.\d+)?)\s*(?:THK|T|MM)?\s*(?P<w>\d+(?:\.\d+)?)\s*[xX*]\s*(?P<l>\d+(?:\.\d+)?)"
CHANNEL_RE = r"\b(?P<type>ISMC)\b\s*(?P<size>\d+\s*[xX]\s*\d+)\s*(?P<length>\d+(?:\.\d+)?)\s*(?:LG|L|LONG)?\b"
BEAM_RE = r"\b(?P<type>ISMB)\b\s*(?P<size>\d+\s*[xX]\s*\d+)\s*(?P<length>\d+(?:\.\d+)?)\s*(?:LG|L|LONG)?\b"
Parser output contract
json

{
  "material_family": "PLATE",
  "material_subtype": "CHEQUERED_PLATE",
  "thickness_mm": 6.0,
  "width_mm": 560.0,
  "length_mm": 3200.0,
  "profile_size": null,
  "rotation_allowed": true,
  "confidence": 0.96,
  "parse_method": "regex_plate_v2"
}
Fallback AI parser
The AI parser should be used when deterministic parsing fails or confidence is below a configurable threshold, such as 0.80. It should receive raw text plus context such as known units, project defaults, and allowed material families. Its job is structured extraction, not free-form explanation.

Example prompt contract:

json

{
  "description": "PLT 8MM 1500X3000 MS",
  "known_materials": ["MS", "SS", "CHQ.PL", "ISMC", "ISMB"],
  "units": "mm",
  "output_schema": {
    "material_family": "string",
    "thickness_mm": "number|null",
    "width_mm": "number|null",
    "length_mm": "number|null",
    "profile_size": "string|null"
  }
}
Confidence scoring
Confidence should combine parser certainty with validation signals:

Regex match completeness.

Numeric plausibility.

Allowed material family match.

Unit consistency.

Historical pattern frequency.

Cross-column corroboration, such as thickness column matching description thickness.

Suggested score bands:

Score	Meaning	System action
0.95-1.00	Highly reliable	Auto-accept
0.80-0.94	Good	Accept, highlight for optional review
0.60-0.79	Weak	Send to review queue
<0.60	Unreliable	Block optimization until corrected
Data cleaning and validation
Duplicate detection
Duplicates should be evaluated in two forms: exact duplicates and semantic duplicates. Exact duplicates share identical normalized material, thickness, dimensions, grade, and part mark. Semantic duplicates may have different source descriptions but result in the same manufacturable identity.

Recommended duplicate key for plates:

text

(material_family, material_subtype, grade, thickness_mm, width_mm, length_mm, edge_spec, finish, machine_group)
Quantity merge
When duplicates are confirmed, quantities should be summed while preserving a child-source list for audit and rollback.

OCR correction
OCR-derived rows should undergo extra normalization rules for confusions such as O vs 0, I vs 1, x vs X, and THK variants. OCR outputs should carry a source-risk flag.

Material normalization
The system should map synonyms and abbreviations into controlled vocabularies:

PL, PLATE, MS PLATE → PLATE

CHQ.PL, CHQ PLATE, CHEQUERED → CHEQUERED_PLATE

SS, STAINLESS, SS304 → subtype under stainless family

Dimension validation
Validation rules should detect:

Negative or zero dimensions.

Width greater than stock if rotation disabled.

Unusually large dimensions for project defaults.

Thickness inconsistent with material family.

Profile length outside machine limits.

Missing values
Rows missing essential manufacturable fields should move to a review queue with reasons like “missing thickness” or “ambiguous profile size.”

Wrong units
The importer should detect inch-like patterns and normalize to millimeters when configured. All stored canonical values should use metric millimeters and kilograms.

Rotation rules
Rotation is not universally allowed. Plain plates may allow 90-degree rotation, but grain-sensitive, patterned, or directional materials may not. Chequered plate often needs constrained orientation to maintain tread direction, so the schema must store rotation policy per row.

Material grouping
Grouping principles
Grouping determines which optimization engine, stock catalog, ruleset, and reports apply. It must be deterministic and configurable.

Suggested families
Group	Optimization type	Notes
PL 6 THK, PL 8 THK, PL 10 THK, PL 12 THK	2D	Primary MVP focus.
CHQ.PL by thickness	2D	Rotation may be restricted.
MS Plate	2D	Plain plate family.
SS Plate	2D	May require different cost and constraints.
ISMC	1D	Profile cutting by length.
ISMB	1D	Profile cutting by length.
Pipe	1D	Length optimization in MVP, future tube nesting later.
Flat	1D	Bar optimization.
Angle	1D	Profile cutting.
Round Bar	1D	Bar cutting.
Grouping key example:

text

(material_family, material_subtype, grade, thickness_mm, profile_size, finish, rotation_policy)
Optimization engine
Optimization classes
The platform needs two engines:

1D optimization for bars, flats, channels, beams, pipes, and other stock-length cuts.

2D optimization for plates, chequered plates, and sheet-like materials.

1D optimization
1D optimization solves cut-to-length problems where stock pieces have a fixed length and child parts consume linear segments plus saw kerf and trim allowances. Dynamic programming or branch-and-bound heuristics can be used, but for the MVP a fast heuristic with best-fit decreasing plus improvement passes is sufficient.

2D optimization
2D optimization arranges rectangles on stock sheets to maximize utilization and minimize waste. Nesting software value in fabrication is strongly tied to this function because it reduces manual placement and improves material efficiency.
autodesk

Bin packing and rectangle packing
2D sheet nesting for rectangular parts is a rectangle-packing variant of the broader bin packing problem. The objective is usually to place all parts into the minimum number of sheets or the lowest-cost sheet combination while also minimizing scrap.
pypi
+1

Algorithm families relevant to MVP
Rectpack documents three major heuristic families—MaxRects, Guillotine, and Skyline—and exposes them through a configurable packer interface, which makes it a strong open-source foundation for an MVP in Python.
pypi
+1

Algorithm	How it works	Advantages	Disadvantages	MVP fit
Guillotine	Places a part and splits remaining free area with guillotine cuts	Good for guillotine-constrained cutting, simpler remnant modeling	Can produce fragmented space and lower utilization	Good when machine or process requires guillotine-like behavior.
deepwiki
Skyline	Maintains a skyline profile and places rectangles along it	Fast and simple, often good for strip-like layouts	Weaker on dense irregular spaces	Useful for speed-first scenarios.
deepwiki
MaxRects	Tracks maximal empty rectangles and chooses best fit	Often high utilization and flexible heuristics	Slightly more complex and heavier than Skyline	Best default for plate nesting MVP.
deepwiki
Genetic Algorithm	Evolves placement sequences or sheet choices	Can explore broader search space	Complex tuning, longer runtime, non-deterministic	Better for later advanced optimizer layers.
Simulated Annealing	Probabilistic improvement over time	Good escape from local minima	Runtime-sensitive, requires careful cooling schedule	Good as post-optimization enhancer later.
Recommended MVP algorithm
Use MaxRectsBssf or a closely related MaxRects heuristic as the default plate optimizer because rectpack lists MaxRectsBssf as the default packing algorithm and presents MaxRects as a core family designed around maintaining maximal empty rectangles, which usually delivers a strong balance between packing quality and engineering simplicity. Pair it with offline packing, sorted rectangles, optional rotation, and configurable bin-selection strategies. For processes requiring guillotine constraints, offer a secondary Guillotine mode.
deepwiki

Long-term optimization strategy
The long-term engine should be hybrid:

Deterministic initial solution via MaxRects.

Local improvement passes for part ordering and sheet selection.

Optional metaheuristics such as genetic algorithms or simulated annealing for large jobs or premium plans.

Constraint plugins for grain direction, heat zones, cut sequence, bridge tabs, and remnant preservation.

Recommended engine architecture
text

Input parts -> Group-specific normalizer -> Candidate stock generator -> Core packer -> Improvement pass -> Metrics calculator -> Layout serializer -> Reports
Optimization constraints
Core constraints should include:

Kerf width.

Border margin.

Sheet trim allowance.

Rotation allowed/not allowed.

Common-line cutting flag.

Preferred orientation.

Max sheets or budget ceiling.

Priority parts.

Remnant-preservation threshold.

Objective functions
MVP objective hierarchy:

Minimize number of sheets.

Maximize yield percentage.

Minimize total material cost.

Minimize unusable scrap.

Prefer standard supplier stock sizes.

Later versions can support weighted objective functions configured per organization.

Multi-stock optimization
The engine should support trying multiple available stock sizes and returning ranked scenarios. This is essential because a sheet with higher utilization may still be worse in cost or transport terms than another sheet that yields slightly less but reduces procurement complexity.

Intelligent material purchasing
The purchase advisor should compare candidate stock sizes such as 2500x1250, 3000x1500, and 6000x1500 against a grouped parts set. For each scenario it should compute sheet count, utilized area, scrap area, theoretical weight, material cost, remnant value, and estimated transport burden.

Decision model
Factor	Why it matters
Number of sheets	Impacts handling, loading, and purchasing complexity.
Yield percentage	Indicates material utilization efficiency.
Scrap area/weight	Drives wastage cost.
Sheet cost	Direct procurement impact.
Weight	Affects transport and handling.
Transport assumptions	Longer/larger sheets may cost more to move.
Remnant usability	Some leftovers are reusable assets, others are scrap.
Recommendation logic
A purchase recommendation should not be a single-rule output. It should present ranked options such as:

Lowest total cost.

Highest yield.

Lowest sheet count.

Best balance score.

This makes the system useful across different business policies.

Outputs
File outputs
Output	MVP	Purpose
Excel	Yes	Planner-friendly detailed reports.
PDF	Yes	Shareable management and production packets.
CSV	Yes	Simple downstream data exchange.
JSON	Yes	API and system interoperability.
DXF	Future	Machine/CAD workflow output.
Printable cut layout	Yes	Shop-floor visual reference.
Purchase list	Yes	Procurement decision support.
Scrap report	Yes	Waste measurement.
Material summary	Yes	Group-level totals.
Thickness summary	Yes	Plate planning by thickness.
Weight summary	Yes	Costing and logistics support.
Layout outputs
Each layout should include sheet ID, stock size, part coordinates, rotation state, labels, utilization metrics, and waste polygons or rectangles.

Example serialized layout:

json

{
  "sheet_no": 3,
  "stock": {"length_mm": 3000, "width_mm": 1500, "thickness_mm": 8},
  "parts": [
    {"part_id": "PT-1001", "x": 0, "y": 0, "w": 560, "h": 3200, "rotated": false}
  ],
  "yield_pct": 86.2,
  "scrap_area_mm2": 621000
}