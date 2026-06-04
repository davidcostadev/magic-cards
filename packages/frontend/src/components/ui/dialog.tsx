import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useModalA11y } from './useModalA11y';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /**
   * When false, focus moves to the dialog container instead of the first
   * focusable control — useful when the dialog is driven by keyboard shortcuts
   * and a pre-focused button would look "selected". Defaults to true.
   */
  autoFocus?: boolean;
}

function Dialog({ open, onOpenChange, children, autoFocus = true }: DialogProps) {
  const containerRef = useModalA11y({ open, onOpenChange, autoFocus });

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
        'relative z-50 flex h-dvh w-full max-w-none flex-col overflow-y-auto rounded-none border-0 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg animate-in fade-in sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:border sm:p-8 sm:pb-8 sm:zoom-in-95',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )
);
DialogContent.displayName = 'DialogContent';

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
  );
}

function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-xl font-bold leading-none tracking-tight', className)} {...props} />
  );
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-3 sm:flex-row sm:justify-end mt-6', className)}
      {...props}
    />
  );
}

export { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle };
