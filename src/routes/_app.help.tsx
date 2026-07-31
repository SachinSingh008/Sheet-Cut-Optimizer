import { createFileRoute, Link } from "@tanstack/react-router";
import { UploadCloud, FileQuestion, Ruler, Mail, MessageSquare } from "lucide-react";
import { PageHeader, PageTransition } from "@/components/app/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "How to upload a BOM, supported formats, an optimization guide and how to reach our engineers.",
      },
      { property: "og:title", content: "Help & FAQ — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "How to upload a BOM, supported formats, an optimization guide and how to reach our engineers.",
      },
    ],
  }),
  component: HelpPage,
});

const faqs = [
  {
    q: "How do I upload my bill of materials?",
    a: "Go to Upload and drop your file onto the drop zone, or click to browse. The parser reads the first sheet of a workbook and maps columns for item, description, material grade, thickness, length, width and quantity. Column headers can be in any order.",
  },
  {
    q: "Which file formats are supported?",
    a: "Excel (.xlsx, .xls), CSV, PDF cutting lists and scanned drawings as PNG or JPG. Image and PDF inputs use AI extraction, so review the parsed rows before nesting.",
  },
  {
    q: "How does the optimization work?",
    a: "Parts are grouped by material grade and thickness. Each group is nested onto stock plates using a bottom-left shelf pass followed by MaxRects refinement, honouring your kerf, edge trim and rotation settings. Utilization is calculated as nested part area over total plate area.",
  },
  {
    q: "What kerf value should I use?",
    a: "Typical values: 1.5 mm for laser up to 12 mm plate, 2–3 mm for plasma, 3–4 mm for oxy-fuel on heavy plate. When unsure, use 3 mm — it is conservative for most fabrication shops.",
  },
  {
    q: "Why is a row highlighted in red?",
    a: "The row failed validation — typically a dimension below the minimum nestable size, a missing material grade, or a part larger than the selected stock plate. Edit the row on the Parse Results page or delete it before running the optimizer.",
  },
  {
    q: "Is my data stored anywhere?",
    a: "No. This is a temporary workspace: everything lives in your browser session. Close the tab and the project is gone. There are no accounts and no server-side storage.",
  },
];

const guides = [
  { icon: UploadCloud, title: "How to upload", text: "Prepare a BOM with one row per plate part, including thickness and quantity columns.", to: "/upload" },
  { icon: FileQuestion, title: "Supported formats", text: "XLSX, XLS, CSV, PDF, PNG and JPG up to 25 MB per file.", to: "/upload" },
  { icon: Ruler, title: "Optimization guide", text: "Choose stock size, set kerf and trim, then compare algorithms for best yield.", to: "/optimization" },
] as const;

function HelpPage() {
  return (
    <PageTransition>
      <PageHeader
        eyebrow="SUPPORT"
        title="Help centre"
        description="Everything you need to get from a spreadsheet to a shop-floor cutting plan."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {guides.map((g) => (
          <Link
            key={g.title}
            to={g.to}
            className="rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-lift"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <g.icon className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold">{g.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{g.text}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-6 shadow-soft lg:p-8">
          <h2 className="text-lg font-semibold">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-4">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-soft lg:p-8">
          <h2 className="text-lg font-semibold">Talk to a nesting engineer</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Complex plate profiles, remnant management or CNC post-processors? Our team answers
            within one working day.
          </p>
          <div className="mt-6 space-y-3">
            <a
              href="mailto:support@aisteelcut.io"
              className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
            >
              <Mail className="size-5 text-primary" />
              <span>
                <span className="block text-sm font-medium">support@aisteelcut.io</span>
                <span className="block text-xs text-muted-foreground">Email support</span>
              </span>
            </a>
            <div className="flex items-center gap-3 rounded-xl border p-4">
              <MessageSquare className="size-5 text-accent" />
              <span>
                <span className="block text-sm font-medium">Mon–Sat · 09:00–19:00 IST</span>
                <span className="block text-xs text-muted-foreground">Live chat hours</span>
              </span>
            </div>
          </div>
          <Button asChild className="mt-6 w-full" size="lg">
            <Link to="/upload">Start a new project</Link>
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
