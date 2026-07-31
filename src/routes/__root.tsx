import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Home, RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0a0d12] px-4 overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 size-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-[400px] rounded-full bg-cyan-500/15 blur-[100px]" />

      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg shadow-lg">
            ⚙️
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Steel<span className="text-blue-400">Nest</span> AI
          </span>
        </div>

        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          <span className="mb-4 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-400">
            404 · Not Found
          </span>

          <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-8xl font-black tracking-tighter text-transparent">
            404
          </h1>

          <div className="mx-auto my-4 h-0.5 w-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />

          <h2 className="mb-2 text-lg font-semibold text-white">Page not found</h2>
          <p className="mb-8 text-sm leading-relaxed text-slate-400">
            The route you're looking for may have been moved,
            renamed, or is temporarily unavailable.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 hover:shadow-blue-500/45"
            >
              <Home className="size-4" /> Back to Workbench
            </Link>
            <button
              onClick={() => history.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
            >
              <ArrowLeft className="size-4" /> Go Back
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
            SteelNest AI · 1810 Systems
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0a0d12] px-4 overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 size-[500px] rounded-full bg-rose-700/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 size-[400px] rounded-full bg-orange-500/10 blur-[100px]" />

      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(239,68,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg shadow-lg">
            ⚙️
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            Steel<span className="text-blue-400">Nest</span> AI
          </span>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-500 to-transparent" />

          <span className="mb-4 inline-block rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-rose-400">
            Application Error
          </span>

          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-rose-500/10 text-rose-400">
            <AlertTriangle className="size-8" />
          </div>

          <div className="mx-auto mb-4 h-0.5 w-10 rounded-full bg-gradient-to-r from-rose-500 to-orange-400" />

          <h2 className="mb-2 text-lg font-semibold text-white">Something went wrong</h2>
          <p className="mb-8 text-sm leading-relaxed text-slate-400">
            An unexpected error occurred. You can try refreshing
            the page or return to the workbench.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => { router.invalidate(); reset(); }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5"
            >
              <RefreshCw className="size-4" /> Try Again
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10"
            >
              <Home className="size-4" /> Go Home
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
            SteelNest AI · 1810 Systems
          </div>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SteelNest AI — AI Steel Cut Optimizer" },
      { name: "description", content: "AI-Powered Steel Plate and Profile Cut Sheet Optimization Platform" },
      { name: "author", content: "1810 Systems" },
      { property: "og:title", content: "SteelNest AI — AI Steel Cut Optimizer" },
      { property: "og:description", content: "AI-Powered Steel Plate and Profile Cut Sheet Optimization Platform" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],

    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
