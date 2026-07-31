import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex flex-col leading-none select-none", className)}>
      <span className="text-[17px] font-bold tracking-tight text-foreground">
        AI Steel Cut <span className="text-primary font-semibold">Optimizer</span>
      </span>
      <span className="mt-1 text-[9.5px] font-semibold tracking-widest text-primary uppercase">
        Powered by 1810 Systems
      </span>
    </span>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="font-bold text-primary tracking-tight">
      SteelNest AI
    </span>
  );
}
