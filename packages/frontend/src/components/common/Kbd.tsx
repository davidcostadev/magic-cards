import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

/**
 * Visual keyboard-key badge. Uses currentColor so it stays legible on both
 * neutral surfaces and colored (success/destructive/primary) buttons.
 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        // Keyboard hints are pointless on touch devices, so only show from `sm` up.
        "hidden h-5 min-w-[1.25rem] select-none items-center justify-center rounded border border-current px-1 font-mono text-[0.7rem] font-bold leading-none opacity-80 sm:inline-flex",
        className
      )}
    >
      {children}
    </kbd>
  );
}
