import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cpu,
  LayoutGrid,
  FileSpreadsheet,
  ShieldCheck,
  Gauge,
  Recycle,
  Sparkles,
  Layers3,
  CheckCircle2,
  Sliders,
  Maximize2,
  Box,
  FileCheck,
  TrendingUp,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SteelNest AI — Plate & Profile Cut Sheet Optimization Engine" },
      {
        name: "description",
        content:
          "AI-powered steel plate and profile nesting platform by 1810 Systems. Transform raw BOMs into optimized cut sheets, reduce scrap, and generate purchase reports.",
      },
      { property: "og:title", content: "SteelNest AI — Steel Cut Sheet Optimization Platform" },
      {
        property: "og:description",
        content:
          "Transform raw BOMs into optimized cut sheets, reduce scrap, and generate purchase reports in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: FileSpreadsheet,
    title: "Multi-Format Ingestion",
    text: "Import Excel (.xlsx), CSV, Tekla, AutoCAD, or ERP exports. Normalizes raw descriptions into canonical dimensions automatically.",
  },
  {
    icon: Cpu,
    title: "Dual 2D & 1D Nesting Engine",
    text: "MaxRects rectangle packing for steel plates & best-fit decreasing 1D profile cutters for ISMC channels, ISMB beams, and pipes.",
  },
  {
    icon: LayoutGrid,
    title: "Interactive CAD Visualizer",
    text: "Inspect every nested plate layout with full zoom, pan, part mark highlighting, kerf gap spacing, and waste shading.",
  },
  {
    icon: Recycle,
    title: "Scrap & Remnant Intelligence",
    text: "Calculate exact offcut percentage per sheet and identify reusable rectangular remnants for future fabrication jobs.",
  },
  {
    icon: Gauge,
    title: "Multi-Stock Purchase Advisor",
    text: "Compare multiple standard sheet sizes (2500×1250, 3000×1500, 6000×1500) and rank procurement options by total cost.",
  },
  {
    icon: ShieldCheck,
    title: "Zero-Storage Privacy",
    text: "All calculations process in-session in your browser. No files or confidential project data are retained after closing.",
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Upload & Extract",
    desc: "Drag and drop any engineering BOM or cut list.",
    icon: FileSpreadsheet,
  },
  {
    step: "02",
    title: "Regex & Review",
    desc: "Deterministic regex parser flags ambiguous line items.",
    icon: Sliders,
  },
  {
    step: "03",
    title: "Run Optimization",
    desc: "Select stock plate sizes, set kerf, trim, and rotation rules.",
    icon: Cpu,
  },
  {
    step: "04",
    title: "Release & Export",
    desc: "Download production cut sheets, Excel summaries & PDF packets.",
    icon: FileCheck,
  },
];

const mockParts = [
  { id: "PL-101", x: 10, y: 10, w: 180, h: 90, color: "bg-primary/20 border-primary/40 text-primary" },
  { id: "PL-102", x: 200, y: 10, w: 140, h: 90, color: "bg-accent/20 border-accent/40 text-accent" },
  { id: "PL-103", x: 10, y: 110, w: 110, h: 120, color: "bg-chart-3/20 border-chart-3/40 text-chart-3" },
  { id: "PL-104", x: 130, y: 110, w: 210, h: 60, color: "bg-chart-4/20 border-chart-4/40 text-chart-4" },
  { id: "CHQ-01", x: 130, y: 180, w: 210, h: 50, color: "bg-chart-5/20 border-chart-5/40 text-chart-5" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/help">Documentation</Link>
            </Button>
            <Button asChild size="sm" className="shadow-md">
              <Link to="/dashboard">
                Open Workbench <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32">
        {/* Subtle grid background */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute top-1/4 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary"
              >
                <Sparkles className="size-3.5" />
                <span>INDUSTRIAL FABRICATION ENGINE</span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.1]"
              >
                Turn Raw BOMs into <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Optimized Cut Sheets
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="mt-6 text-base text-muted-foreground sm:text-lg max-w-2xl leading-relaxed"
              >
                Drop in your bill of materials (Excel, CSV, ERP exports), configure kerf and sheet stock sizes, and generate machine-ready plate nesting layouts with purchase and scrap analytics in seconds.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-8 flex flex-wrap gap-4"
              >
                <Button size="lg" asChild className="px-7 text-base font-semibold shadow-lg">
                  <Link to="/upload">
                    Upload BOM Spreadsheet <ArrowRight className="ml-2 size-5" />
                  </Link>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.32 }}
                className="mt-10 flex flex-wrap items-center gap-6 text-xs text-muted-foreground"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4 text-primary" /> 2D Plate & 1D Bar Nesting
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4 text-primary" /> Regex BOM Parsing
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4 text-primary" /> Multi-Stock Procurement
                </span>
              </motion.div>
            </div>

            {/* Right Interactive CAD Layout Visual Mock */}
            <div className="lg:col-span-5">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="relative rounded-2xl border border-border/80 bg-card/95 p-5 shadow-2xl backdrop-blur"
              >
                {/* Visualizer Header */}
                <div className="flex items-center justify-between border-b pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      Live CAD Layout Preview
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                    <span className="rounded bg-muted px-2 py-0.5 font-medium">3000 × 1500 mm</span>
                    <span className="rounded bg-primary-soft text-primary font-bold px-2 py-0.5">
                      94.8% Yield
                    </span>
                  </div>
                </div>

                {/* Simulated Sheet Canvas */}
                <div className="relative h-64 w-full rounded-xl border border-dashed border-border bg-muted/40 overflow-hidden p-2">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:16px_16px]" />

                  {/* Render Mock Nested Rectangles */}
                  {mockParts.map((p) => (
                    <motion.div
                      key={p.id}
                      whileHover={{ scale: 1.02 }}
                      style={{
                        left: `${(p.x / 360) * 100}%`,
                        top: `${(p.y / 240) * 100}%`,
                        width: `${(p.w / 360) * 100}%`,
                        height: `${(p.h / 240) * 100}%`,
                      }}
                      className={`absolute flex items-center justify-center rounded border font-mono text-[10px] font-semibold shadow-xs transition-transform ${p.color}`}
                    >
                      {p.id}
                    </motion.div>
                  ))}

                  {/* Kerf & Margin Label Overlay */}
                  <div className="absolute bottom-2 right-2 rounded bg-background/90 backdrop-blur px-2 py-1 text-[10px] font-mono text-muted-foreground border shadow-xs">
                    Kerf: 3.0mm | Trim: 4.0mm
                  </div>
                </div>

                {/* Footer Metrics Card */}
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border bg-muted/30 p-2.5">
                    <p className="text-muted-foreground text-[11px]">Placed Parts</p>
                    <p className="font-semibold text-foreground text-sm mt-0.5">24 Pcs</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-2.5">
                    <p className="text-muted-foreground text-[11px]">Scrap Area</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">5.2%</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-2.5">
                    <p className="text-muted-foreground text-[11px]">Sheets Needed</p>
                    <p className="font-semibold text-primary text-sm mt-0.5">3 Sheets</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="border-t border-border/60 bg-muted/20 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              SEAMLESS FABRICATION FLOW
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              From Spreadsheet to Shop Floor in 4 Steps
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i }}
                className="relative flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-soft transition-all hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold tracking-widest text-primary/70">
                      STEP {s.step}
                    </span>
                    <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                      <s.icon className="size-4" />
                    </span>
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              INDUSTRIAL ENGINE FEATURES
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Built for Heavy Steel & Fabrication Shops
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * i }}
                className="group rounded-2xl border bg-card p-6 shadow-soft transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary transition-transform group-hover:scale-110">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-base">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Industrial Benchmarks */}
      <section className="border-t border-border/60 bg-card py-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {[
              ["94.8%", "Average Plate Yield"],
              ["-31%", "Material Scrap Cost Reduction"],
              ["< 5s", "200-Part Nesting Speed"],
              ["100%", "In-Memory Privacy"],
            ].map(([val, lbl]) => (
              <div key={lbl} className="p-4">
                <p className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">{val}</p>
                <p className="mt-2 text-xs text-muted-foreground font-medium sm:text-sm">{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Call to Action */}
      <section className="relative overflow-hidden bg-primary/5 py-16">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Start Optimizing Your Fabrication BOMs Today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground text-sm sm:text-base">
            No registration required. Load your Excel BOM to generate complete nesting layouts in seconds.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild className="shadow-lg">
              <Link to="/upload">
                Upload BOM Now <ArrowRight className="ml-2 size-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-background py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm text-muted-foreground">
          <Logo />
          <p className="text-xs font-medium">© 2026 SteelNest AI · Powered by 1810 Systems</p>
        </div>
      </footer>
    </div>
  );
}
