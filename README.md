# SteelNest AI — AI-Powered Plate, Profile & Fabrication Optimization Platform

> **Powered by 1810 Systems**

SteelNest AI is an industrial fabrication planning and plate/profile cut-sheet optimization engine. It transforms raw structured engineering bills of materials (BOMs from Excel, CSV, AutoCAD, Tekla, or ERP exports) into machine-feasible cutting layouts, multi-stock procurement recommendations, utilization analytics, and production-ready reports.

---

## 🎯 Key Capabilities

* **Digital BOM Ingestion:** Import `.xlsx`, `.xls`, `.csv`, and ERP exports directly. Preserves row lineage and raw attributes.
* **Deterministic Regex & Token Parsing:** Extracts part mark, material family, thickness, length, width, profile size (e.g. `PL 6 THK 200x300`, `ISMC 150x75`), grade, and rotation policies automatically.
* **Confidence Scoring & Review Queue:** Scores parsed line items from $0.0$ to $1.0$. Auto-accepts high-confidence rows and routes low-confidence/ambiguous items to an inline review queue.
* **Duplicate Merging:** Automatically merges identical and semantic duplicate parts (matching material, thickness, grade, dimensions) while maintaining source row traceability.
* **2D Plate & 1D Profile Optimization Engine:**
  * **2D Sheet Nesting:** Uses `rectpack` (MaxRects & Guillotine heuristics) with configurable kerf, edge trim allowance, sheet margins, and orientation/grain rotation constraints.
  * **1D Linear Cutting:** Cut-to-length optimization for channels (`ISMC`), beams (`ISMB`), angles, flats, and pipes.
* **Multi-Stock Procurement Advisor:** Compares multiple stock plate sizes (e.g. $2500 \times 1250$, $3000 \times 1500$, $6000 \times 1500$ mm) and ranks options by total material cost, yield %, scrap weight, and sheet count.
* **Interactive Canvas Visualizer:** Zoomable and draggable layout viewer displaying part labels, rotation status, kerf gaps, and scrap zones per sheet.
* **Multi-Format Export Packets:** Generates Excel workbooks, PDF summary packets, CSV cut lists, and JSON API payloads.

---

## 🏗️ System Architecture

```
                                  [ User Workspace ]
                                          │
                                 (Excel / CSV / BOM)
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │   Ingestion & Column Mapper    │
                         └─────────────────────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │   Regex Normalizer & Parser     │
                         └─────────────────────────────────┘
                                          │
                                ┌─────────┴─────────┐
                                ▼                   ▼
                       [ Review Queue ]    [ Canonical Parts ]
                                                    │
                                                    ▼
                         ┌─────────────────────────────────┐
                         │   Duplicate Detector & Merge    │
                         └─────────────────────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │   Optimization Engine           │
                         │   - 2D rectpack MaxRects        │
                         │   - 1D Best-Fit Decreasing      │
                         └─────────────────────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │  Multi-Stock Purchase Advisor   │
                         └─────────────────────────────────┘
                                          │
                                ┌─────────┴─────────┐
                                ▼                   ▼
                       [ Canvas Visualizer ]   [ Multi-Format Reports ]
```

---

## 🛠️ Technology Stack

* **Frontend:** React 19, TypeScript, Vite 8, TanStack Router, TanStack Query, TailwindCSS v4, Radix UI, Lucide React, Framer Motion
* **Backend Engine:** Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy 2.0, rectpack, Polars / Pandas, OpenPyXL, ReportLab / WeasyPrint
* **Database & Storage:** PostgreSQL / SQLite, Redis, Celery worker queue

---

## 📁 Repository Structure

```
Sheet-Cut-Optimizer/
├── Documents/               # Product Requirements, System Blueprint, Architecture & Workflow specs
├── public/                  # Static web assets & icons
├── src/
│   ├── components/
│   │   ├── app/            # Topbar, Sidebar, Page Headers, Stat Cards, Sheet Viewer
│   │   ├── brand/          # Logo & 1810 Systems branding components
│   │   └── ui/             # Radix & Tailwind design system UI components
│   ├── lib/                # Store, mock data engine, and utility functions
│   ├── routes/             # TanStack Router file-based application routes
│   │   ├── _app.dashboard.tsx
│   │   ├── _app.upload.tsx
│   │   ├── _app.parse.tsx
│   │   ├── _app.thickness.tsx
│   │   ├── _app.optimization.tsx
│   │   ├── _app.layouts.tsx
│   │   └── _app.reports.tsx
│   ├── router.tsx
│   ├── server.ts
│   └── styles.css
├── package.json             # Frontend dependencies & scripts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: `v20.0.0` or higher (or `bun` / `pnpm` / `npm`)
* **Python**: `3.11+` (for backend optimization engine)

### 1. Frontend Web Workbench

Install frontend dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

### 2. Backend Engine (FastAPI & rectpack)

Set up Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install fastapi uvicorn pydantic rectpack pandas openpyxl
```

Run the backend server:
```bash
uvicorn apps.api.app.main:app --reload --port 8000
```

---

## 📄 Documentation Index

Refer to the `/Documents` directory for in-depth specs:
- `steel-plate-cut-sheet-optimizer-blueprint.md`: Complete blueprint and product requirements.
- `Architehcure.md`: Entity data model, DB tables, API specs, and 120-task breakdown.
- `End-to-end workflow.md`: 12-stage fabrication planning workflow.
- `Data inputs Output.md`: Ingestion rules, regex specifications, algorithms, and report structures.
- `Reports.md`: Detailed design guidelines for material, scrap, production, and cost reports.

---

## ⚖️ License & Attribution

Developed for industrial steel fabrication planning.  
**Powered by 1810 Systems** — All rights reserved.
