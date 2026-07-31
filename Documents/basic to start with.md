SteelNest AI Platform Blueprint
Proposed enterprise product name: SteelNest AI — AI-Powered Plate, Profile, and Fabrication Optimization Platform.

This document is a combined Software Requirements Specification, Technical Design Document, Product Blueprint, Solution Architecture Guide, and AI-assisted implementation plan for an industrial fabrication planning platform focused on steel plate and profile optimization. It is written to align product strategy, engineering design, system architecture, and phased implementation so that investors, architects, developers, and future AI coding agents can build from a single source of truth.

Document purpose
Steel fabrication shops still rely on fragmented workflows where engineering drawings, bill-of-material exports, spreadsheet preparation, thickness grouping, cut-list generation, nesting software import, procurement planning, and production release are handled across multiple disconnected tools and manual steps. Commercial nesting platforms position themselves around material savings, integration with CAD/CAM workflows, inventory, quoting, remnant handling, and automated planning, which confirms that the industry values workflow compression as much as pure nesting quality. This blueprint defines a product that initially focuses on digital BOM-driven plate optimization and later expands toward profiles, CNC outputs, ERP integration, and AI-assisted fabrication planning.
autodesk
+2

Executive overview
The proposed platform ingests structured fabrication inputs such as Excel, CSV, ERP exports, CAD-generated BOMs, and manual entries; normalizes parts and materials; classifies parts into manufacturable groups; optimizes sheet usage using 1D and 2D packing algorithms; and generates actionable purchase, production, and reporting outputs. Nesting software is widely used to maximize material utilization, reduce manual placement effort, improve production efficiency, and support interactive review of layouts before release, making this product direction commercially sound. Modern fabrication platforms also differentiate through integration with business systems, remnant management, quoting, and shop-floor traceability, which supports building this product as more than a narrow optimization engine.
autodesk
+2

The MVP should deliberately avoid OCR dependency. OCR on poor-quality fabrication drawings often introduces ambiguity in dimensions, material codes, and symbols, while modern fabrication workflows already produce structured exports from spreadsheets, BIM/CAD tools, and ERP systems; software vendors in this space emphasize import pipelines and workflow integration rather than OCR as the core data source. OCR should therefore be implemented as an optional helper that assists when no structured input exists, but the primary architecture must assume digital tabular data as the source of truth.
autodesk
+2

Industry context
Current fabrication workflow
A common workflow in steel fabrication begins when a design engineer creates a CAD or BIM model and exports a drawing package or bill of materials. Fabrication or planning engineers then open these drawings, read tables manually, retype line items into Excel, separate items by material family and thickness, prepare manual cut lists, import them into a nesting tool, inspect waste, decide sheet purchases, and only then release work to procurement and production. Commercial systems explicitly market import from design/BIM tools, list management, automatic nesting, summary sheets, quotations, inventory linkage, and production coordination, which indicates that the manual multi-step workflow remains a pain point in the market.
strumis
+1

This workflow is slow because information is repeatedly re-entered across tools. It is repetitive because the same fields—material, thickness, quantity, dimensions, lengths, and mark numbers—are classified multiple times in Excel, nesting, and purchasing stages. It is error-prone because each manual transcription step can corrupt dimensions or quantities; Autodesk’s customer example specifically highlights that one incorrect manual value can propagate into a large batch of incorrectly sized sheets. It is expensive because poor grouping, suboptimal nesting, and disconnected procurement decisions increase scrap, labor cost, and schedule uncertainty, while large fabrication suites market profitability gains through better nesting, quoting, scheduling, and purchasing coordination.
autodesk
+2

Why large projects suffer more
The manual approach scales badly with project size because line item counts, material variants, revision churn, and remnant tracking all increase together. Once hundreds or thousands of parts exist across multiple thicknesses and materials, spreadsheet-based filtering, duplicate merging, and purchase planning become operational bottlenecks. Vendors such as SigmaNEST and STRUMIS emphasize business integration, scheduling, inventory, remnant workflow, and automated import precisely because large shops cannot afford to manage those variables manually at scale.

Scope
Current scope
The initial release should support plate and simple profile planning using structured data inputs such as Excel, CSV, and ERP exports. It should normalize line items, parse descriptions, classify parts, detect duplicates, optimize plate cutting, compare stock sheet purchase options, and generate reports in Excel, PDF, CSV, and JSON. This aligns with the most immediate value users expect from nesting software: improved material use, faster nesting, and better planning outputs.
autodesk

Future scope
Future releases should add DXF generation, CNC file preparation, remnant reuse, costing, stock inventory, profile optimization, quotation support, shop-floor feedback, and AI copilots. Established platforms differentiate themselves through quoting, scheduling, inventory, remnant management, and machine integration, making these logical expansion paths.
sigmanest
+1

Enterprise scope
Enterprise deployment should include role-based access, organization-level settings, audit logs, multi-project handling, approval workflows, API integrations, SSO, background optimization queues, high-volume imports, traceability, and observability. SigmaNEST and STRUMIS both market integration with broader business systems and production control, which supports designing the architecture for enterprise-grade extension rather than a single-user tool.
strumis
+1

SaaS scope
A SaaS deployment should support multi-tenant organizations, cloud storage, browser-based optimization review, usage-based limits, subscription plans, and API-based integration with ERP/CAD exporters.

Desktop scope
A desktop-first or hybrid deployment can be valuable for factories with poor internet connectivity, strict data residency requirements, or local machine connectivity needs. The preferred strategy is web-first architecture with optional desktop packaging via Tauri later.

Cloud scope
The cloud architecture should prioritize managed storage, async workers, containerized APIs, and a PostgreSQL-backed data layer, while preserving a local SQLite mode for pilot deployments.

Target users
Fabrication engineer
The fabrication engineer is the primary operator. This user uploads BOM data, reviews parsed parts, resolves ambiguous descriptions, configures sheet options, runs optimization, validates layouts, and exports cut plans.

Production engineer
The production engineer consumes approved layouts, shop packets, cut sheets, and summary reports. This role also provides feedback about machine constraints, kerf, preferred sheet sizes, and manufacturability restrictions.

Purchase department
The purchase department uses material summaries, stock-size comparisons, procurement recommendations, and weight/cost reports to choose the best buying option. Integration with inventory and supplier catalogs becomes more important as the product matures.
sigmanest
+1

Planning department
Planning users coordinate sequencing, work-package release, revision tracking, and due-date alignment. They benefit from optimization summaries, grouped part views, and remnant usage recommendations.

Project manager
Project managers need project-level dashboards, waste metrics, cost insight, progress snapshots, and decision visibility across engineering, purchasing, and production.

Workshop supervisor
The workshop supervisor consumes printable layouts, cut packets, and part-tracking references. Later versions should provide QR or barcode links between digital plans and physical production.

Management
Management uses high-level yield, cost, turnaround, and utilization reporting to measure performance and compare planning decisions across projects.