import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useModalA11y } from './useModalA11y';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  autoFocus?: boolean;
}

/**
 * A bottom sheet on mobile (slides up, anchored to the bottom edge) and a centered modal on
 * desktop. Shares scroll-lock / focus-trap / Escape behaviour with Dialog via `useModalA11y`.
 */
function Sheet({ open, onOpenChange, children, autoFocus = true }: SheetProps) {
  const containerRef = useModalA11y({ open, onOpenChange, autoFocus });

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end justify-center focus:outline-none sm:items-center sm:p-5"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/60" />
      {children}
    </div>
  );
}

const SheetContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative z-50 flex max-h-[85dvh] w-full flex-col overflow-y-auto rounded-t-2xl border border-b-0 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lg animate-[slideUp_200ms_ease-out] sm:max-h-[90dvh] sm:max-w-md sm:rounded-2xl sm:border-b sm:p-7 sm:pb-7 sm:animate-[fadeIn_150ms_ease-out]',
        className
      )}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      {children}
    </div>
  )
);
SheetContent.displayName = 'SheetContent';

function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2', className)} {...props} />;
}

function SheetTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-xl font-bold leading-none tracking-tight', className)} {...props} />
  );
}

function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle };
