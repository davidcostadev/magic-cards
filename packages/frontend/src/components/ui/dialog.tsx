import { type ReactNode, type HTMLAttributes, forwardRef, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const container = containerRef.current;
    const focusables = () => Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    // Move focus into the dialog so keyboard users start inside it
    (focusables()[0] ?? container)?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex justify-center p-0 focus:outline-none sm:items-center sm:p-5"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/60" />
      {children}
    </div>
  );
}

const DialogContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative z-50 flex h-dvh w-full max-w-none flex-col overflow-y-auto rounded-none border-0 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg animate-in fade-in sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:border sm:p-8 sm:pb-8 sm:zoom-in-95",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />;
}

function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xl font-bold leading-none tracking-tight", className)} {...props} />;
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse gap-3 sm:flex-row sm:justify-end mt-6", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter };
