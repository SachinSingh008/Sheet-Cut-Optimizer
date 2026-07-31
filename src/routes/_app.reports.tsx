import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FileSpreadsheet, FileText, FileDown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageTransition, EmptyState } from "@/components/app/page-header";
import { PdfLayoutReport } from "@/components/app/pdf-layout-report";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { store, useAppState } from "@/lib/store";
import { groupByThickness, MATERIAL_RATE, partWeight } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Material distribution, scrap analysis, purchasing lists and Excel, PDF and CSV downloads.",
      },
      { property: "og:title", content: "Reports — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Material distribution, scrap analysis, purchasing lists and Excel, PDF and CSV downloads.",
      },
    ],
  }),
  component: ReportsPage,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function ReportsPage() {
  const { parts, result } = useAppState();
  const [showPdfModal, setShowPdfModal] = useState(false);

  const materialData = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of parts) map.set(p.material, (map.get(p.material) ?? 0) + partWeight(p));
    return [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [parts]);

  const thicknessData = useMemo(
    () =>
      groupByThickness(parts).map((g) => ({
        name: `PL ${g.thickness}`,
        pieces: g.pieces,
        weight: Math.round(g.weight),
      })),
    [parts],
  );

  const usageData = useMemo(
    () =>
      (result?.sheets ?? []).map((s, i) => ({
        name: s.id,
        utilization: Number(s.utilization.toFixed(1)),
        scrap: Number((100 - s.utilization).toFixed(1)),
        cumulative: i + 1,
      })),
    [result],
  );

  if (!parts.length) {
    return (
      <PageTransition>
        <PageHeader eyebrow="STEP 5" title="Reports" />
        <EmptyState
          title="No data to report"
          description="Parse a BOM and run the optimizer to generate material, scrap and purchasing reports."
          action={<Button onClick={() => store.loadDemo()}>Load demo</Button>}
        />
      </PageTransition>
    );
  }

  const download = (kind: string) => {
    if (kind === "PDF" && result) {
      setShowPdfModal(true);
      return;
    }
    toast.success(`${kind} export queued`, {
      description: "Your report will download once backend export is connected.",
    });
  };

  const purchasing = groupByThickness(parts).map((g) => {
    const sheets = result?.sheets.filter((s) => s.thickness === g.thickness).length ?? 0;
    const material = g.parts[0]?.material ?? "IS2062 E250A";
    const area = (result?.config.sheetLength ?? 3000) * (result?.config.sheetWidth ?? 1500);
    const weight = sheets * area * g.thickness * 7.85e-6;
    return {
      thickness: g.thickness,
      material,
      sheets,
      weight,
      cost: weight * (MATERIAL_RATE[material] ?? 65),
    };
  });

  return (
    <PageTransition>
      {showPdfModal && result && (
        <PdfLayoutReport result={result} onClose={() => setShowPdfModal(false)} />
      )}

      <PageHeader
        eyebrow="STEP 5"
        title="Reports & Exports"
        description="Shop-floor ready documentation: material summary, scrap analysis and printable PDF cut list."
        actions={
          <>
            <Button variant="outline" onClick={() => download("Excel")}>
              <FileSpreadsheet /> Excel
            </Button>
            {result && (
              <Button onClick={() => setShowPdfModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-soft">
                <FileText /> Download PDF Report
              </Button>
            )}
            <Button variant="outline" onClick={() => download("CSV")}>
              <FileDown /> CSV
            </Button>
          </>
        }
      />

      <Tabs defaultValue="summary">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="scrap">Scrap</TabsTrigger>
          <TabsTrigger value="purchasing">Purchasing</TabsTrigger>
          <TabsTrigger value="downloads">Downloads</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Material distribution" subtitle="Net cut weight by grade">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={materialData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={3}>
                    {materialData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} kg`} contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Thickness distribution" subtitle="Pieces per plate thickness">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={thicknessData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="pieces" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="lg:col-span-2">
              <ChartCard title="Material usage across sheets" subtitle="Utilization vs scrap per nested plate">
                {usageData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={usageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={12} unit="%" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="utilization" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="scrap" stroke="var(--chart-5)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    Run the optimizer to chart per-sheet utilization.
                  </p>
                )}
              </ChartCard>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="materials">
          <ReportTable
            headers={["Material grade", "Lines", "Pieces", "Net weight", "Rate", "Value"]}
            rows={[...new Set(parts.map((p) => p.material))].map((m) => {
              const items = parts.filter((p) => p.material === m);
              const w = items.reduce((s, p) => s + partWeight(p), 0);
              return [
                m,
                `${items.length}`,
                `${items.reduce((s, p) => s + p.qty, 0)}`,
                `${w.toFixed(0)} kg`,
                `₹ ${MATERIAL_RATE[m] ?? 65}/kg`,
                `₹ ${(w * (MATERIAL_RATE[m] ?? 65)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
              ];
            })}
          />
        </TabsContent>

        <TabsContent value="scrap">
          {result ? (
            <ReportTable
              headers={["Sheet", "Material", "Thickness", "Parts", "Utilization", "Scrap"]}
              rows={result.sheets.map((s) => [
                s.id,
                s.material,
                `PL ${s.thickness} THK`,
                `${s.placed.length}`,
                `${s.utilization.toFixed(1)}%`,
                `${(100 - s.utilization).toFixed(1)}%`,
              ])}
            />
          ) : (
            <EmptyState title="No scrap data" description="Run the optimizer first." />
          )}
        </TabsContent>

        <TabsContent value="purchasing">
          <ReportTable
            headers={["Thickness", "Material", "Sheets to buy", "Weight", "Estimated cost"]}
            rows={purchasing.map((p) => [
              `PL ${p.thickness} THK`,
              p.material,
              `${p.sheets}`,
              `${p.weight.toFixed(0)} kg`,
              `₹ ${p.cost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
            ])}
          />
        </TabsContent>

        <TabsContent value="downloads">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: FileSpreadsheet, title: "Excel workbook", text: "Parts, nesting map, purchase list and scrap sheet.", kind: "Excel" },
              { icon: FileText, title: "PDF report", text: "Printable cut layouts with dimensions for the shop floor.", kind: "PDF" },
              { icon: FileDown, title: "CSV data", text: "Raw nesting coordinates for CAM/CNC import.", kind: "CSV" },
            ].map((d) => (
              <div key={d.kind} className="rounded-2xl border bg-card p-6 shadow-soft">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <d.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{d.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{d.text}</p>
                <Button className="mt-5 w-full" onClick={() => download(d.kind)}>
                  <Sparkles /> Download {d.kind}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </PageTransition>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/60">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t transition-colors hover:bg-muted/40">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "px-4 py-3 font-medium" : "px-4 py-3 tabular-nums"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
