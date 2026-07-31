import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UploadCloud,
  Table2,
  Layers3,
  Grid2x2Check,
  FileBarChart2,
  Settings2,
  LifeBuoy,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Upload", icon: UploadCloud },
  { to: "/parse", label: "Parse Results", icon: Table2 },
  { to: "/thickness", label: "Thickness Groups", icon: Layers3 },
  { to: "/layouts", label: "Cut Layouts", icon: Grid2x2Check },
  { to: "/reports", label: "Reports", icon: FileBarChart2 },
] as const;

const footerNav = [
  { to: "/settings", label: "Settings", icon: Settings2 },
  { to: "/help", label: "Help", icon: LifeBuoy },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { result, parts } = useAppState();

  const item = (to: string, label: string, Icon: typeof LayoutDashboard) => (
    <Link
      key={to}
      to={to}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        pathname === to
          ? "bg-primary-soft text-primary shadow-soft"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-[18px] transition-transform group-hover:scale-110")} />
      {label}
    </Link>
  );

  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center px-5">
        <Link to="/">
          <Logo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
          WORKSPACE
        </p>
        {nav.map((n) => item(n.to, n.label, n.icon))}

        <p className="px-3 pt-6 pb-2 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
          SUPPORT
        </p>
        {footerNav.map((n) => item(n.to, n.label, n.icon))}
      </nav>

      <div className="m-3 rounded-2xl border bg-primary-soft/60 p-4">
        <p className="text-xs font-semibold text-primary">Auto-Optimized Session</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {parts.length
            ? `${parts.length} BOM lines loaded${result ? ` · ${result.sheetCount} sheets nested` : ""}. Nothing stored.`
            : "No account needed. Files process in your session."}
        </p>
      </div>
    </aside>
  );
}
