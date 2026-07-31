import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Ruler, Palette, Globe, Info, Save } from "lucide-react";
import { PageHeader, PageTransition } from "@/components/app/page-header";
import { PlateTypeInventorySection } from "@/components/app/plate-type-inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";
import { store, useAppState } from "@/lib/store";
import { SHEET_SIZES } from "@/lib/mock-data";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — AI Steel Cut Optimizer" },
      {
        name: "description",
        content: "Set default kerf, units, theme, stock plate size and language for your nesting session.",
      },
      { property: "og:title", content: "Settings — AI Steel Cut Optimizer" },
      {
        property: "og:description",
        content: "Set default kerf, units, theme, stock plate size and language for your nesting session.",
      },
    ],
  }),
  component: SettingsPage,
});

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Ruler;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SettingsPage() {
  const { config } = useAppState();
  const { dark, toggle } = useTheme();

  return (
    <PageTransition>
      <PageHeader
        eyebrow="PREFERENCES"
        title="Settings"
        description="Session defaults for this workspace. Configure stock plate sizes, Excel abbreviations, and nesting rules."
        actions={
          <Button size="lg" onClick={() => toast.success("Preferences saved for this session")}>
            <Save /> Save preferences
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Ruler} title="Cutting defaults" description="Applied to every new optimization run">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="kerf">Default kerf (mm)</Label>
              <Input
                id="kerf"
                type="number"
                step="0.5"
                value={config.kerf}
                onChange={(e) => store.set({ config: { ...config, kerf: Number(e.target.value) } })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Default fallback sheet size</Label>
              <Select
                value={`${config.sheetLength}x${config.sheetWidth}`}
                onValueChange={(v) => {
                  const [l, w] = v.split("x").map(Number);
                  store.set({ config: { ...config, sheetLength: l ?? 3000, sheetWidth: w ?? 1500 } });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHEET_SIZES.map((s) => (
                    <SelectItem key={s.label} value={`${s.length}x${s.width}`}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Units</Label>
              <Select defaultValue="metric">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric — mm / kg</SelectItem>
                  <SelectItem value="imperial">Imperial — in / lb</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section icon={Palette} title="Appearance" description="Theme for this browser">
          <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-4">
            <div>
              <p className="font-medium">Dark mode</p>
              <p className="text-sm text-muted-foreground">Reduced glare for shop-floor terminals</p>
            </div>
            <Switch checked={dark} onCheckedChange={toggle} />
          </div>
        </Section>

        <Section icon={Globe} title="Language & region" description="Interface language and number format">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label>Language</Label>
              <Select defaultValue="en">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Currency</Label>
              <Select defaultValue="inr">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inr">₹ Indian Rupee</SelectItem>
                  <SelectItem value="usd">$ US Dollar</SelectItem>
                  <SelectItem value="eur">€ Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section icon={Info} title="About" description="AI Steel Cut Optimizer">
          <dl className="space-y-3 text-sm">
            {[
              ["Version", "1.4.0"],
              ["Nesting engine", "MaxRects + genetic refinement"],
              ["Data retention", "Session only — nothing stored"],
              ["Supported formats", "XLSX, XLS, CSV, PDF, PNG, JPG"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b pb-3 last:border-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      {/* Plate Types, Abbreviations & Mill Stock Dimensions Inventory */}
      <PlateTypeInventorySection />
    </PageTransition>
  );
}
