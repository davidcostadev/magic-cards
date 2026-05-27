import { type ReactNode, type HTMLAttributes, forwardRef, useEffect } from "react";
import { cn } from "@/utils/cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/80 animate-in fade-in"
        onClick={() => onOpenChange(false)}
        onKeyDown={(e) => e.key === "Escape" && onOpenChange(false)}
      />
      <div className="fixed inset-0 flex items-center justify-center p-5">
        {children}
      </div>
    </div>
  );
}

const DialogContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative z-50 w-full max-w-lg rounded-2xl border bg-background p-8 shadow-lg animate-in fade-in zoom-in-95",
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
