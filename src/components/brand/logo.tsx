import { cn } from "@/lib/utils";

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id="ascoGrad" x1="0" y1="0" x2="40" y2="40">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#ascoGrad)" />
        <path
          d="M11 27.5 L20 11 L29 27.5"
          stroke="var(--primary-foreground)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        <path
          d="M14.8 21.5 H25.2"
          stroke="var(--primary-foreground)"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle cx="20" cy="11" r="2.6" fill="var(--primary-foreground)" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight">AI Steel Cut</span>
        <span className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground">
          OPTIMIZER
        </span>
      </span>
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id="ascoGradMark" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#ascoGradMark)" />
      <path
        d="M11 27.5 L20 11 L29 27.5"
        stroke="var(--primary-foreground)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.8 21.5 H25.2" stroke="var(--primary-foreground)" strokeWidth="2.4" opacity="0.7" />
    </svg>
  );
}
