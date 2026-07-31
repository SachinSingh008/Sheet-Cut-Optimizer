import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, LayoutGrid, FileSpreadsheet, ShieldCheck, Gauge, Recycle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Steel Cut Optimizer — Nest plate parts, cut scrap" },
      {
        name: "description",
        content:
          "Upload a bill of materials and get AI-nested steel plate cutting layouts with utilization, scrap and purchase reports in seconds.",
      },
      { property: "og:title", content: "AI Steel Cut Optimizer — Nest plate parts, cut scrap" },
      {
        property: "og:description",
        content:
          "Upload a bill of materials and get AI-nested steel plate cutting layouts with utilization, scrap and purchase reports in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: FileSpreadsheet, title: "Any BOM in", text: "Excel, CSV, PDF cut lists or scanned drawings — parsed and validated row by row." },
  { icon: Cpu, title: "AI nesting engine", text: "MaxRects with genetic refinement, honouring kerf, edge trim and grain rotation rules." },
  { icon: LayoutGrid, title: "Interactive layouts", text: "Zoom, pan and inspect every placed part on every plate before it hits the table." },
  { icon: Recycle, title: "Scrap intelligence", text: "See waste per plate and remnant pockets worth keeping for the next job." },
  { icon: Gauge, title: "Utilization reporting", text: "Material, thickness and purchase reports exportable to Excel, PDF and CSV." },
  { icon: ShieldCheck, title: "Nothing stored", text: "A temporary workspace — no accounts, no uploads retained after you close the tab." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link to="/help">Help</Link>
          </Button>
          <Button asChild>
            <Link to="/dashboard">Open app</Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-hero-glow grid-blueprint absolute inset-0 -z-10" />
        <div className="mx-auto max-w-4xl px-6 py-24 text-center lg:py-32">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-semibold tracking-[0.3em] text-primary uppercase"
          >
            Plate nesting, automated
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-6xl"
          >
            Turn a bill of materials into an optimized steel cut sheet
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground"
          >
            Drop in your BOM, set kerf and stock plate size, and get shop-floor-ready nesting
            layouts with utilization, scrap and purchasing reports — in seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-10 flex flex-wrap justify-center gap-3"
          >
            <Button size="lg" asChild>
              <Link to="/upload">
                Start optimizing <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/dashboard">View dashboard</Link>
            </Button>
          </motion.div>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-6">
            {[
              ["92%", "Typical utilization"],
              ["-31%", "Plate purchase drop"],
              ["<8s", "Nest a 200-part BOM"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="text-2xl font-bold tabular-nums sm:text-3xl">{v}</p>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Logo />
          <p>Temporary workspace · No data stored · © 2026 AI Steel Cut Optimizer</p>
        </div>
      </footer>
    </div>
  );
}
