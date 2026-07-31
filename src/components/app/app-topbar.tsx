import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, ChevronRight, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar } from "./app-sidebar";
import { useTheme } from "@/hooks/use-theme";
import { useAppState } from "@/lib/store";
import { useState } from "react";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/upload": "Upload",
  "/parse": "Parse Results",
  "/thickness": "Thickness Groups",
  "/optimization": "Optimization",
  "/layouts": "Cut Layouts",
  "/reports": "Reports",
  "/settings": "Settings",
  "/help": "Help",
};

export function AppTopbar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { dark, toggle } = useTheme();
  const { parts, result, file } = useAppState();
  const [open, setOpen] = useState(false);

  const status = result
    ? { label: "Optimized", cls: "text-success bg-success/12" }
    : parts.length
      ? { label: "BOM parsed", cls: "text-primary bg-primary/12" }
      : file
        ? { label: "Awaiting parse", cls: "text-warning bg-warning/15" }
        : { label: "No project", cls: "text-muted-foreground bg-muted" };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b glass-panel px-4 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[264px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Workspace</span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="truncate font-medium">{titles[pathname] ?? "Dashboard"}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${status.cls}`}
        >
          <CircleDot className="size-3.5" />
          {status.label}
        </span>
        <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle theme">
          {dark ? <Sun /> : <Moon />}
        </Button>
      </div>
    </header>
  );
}
