import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

/**
 * A native `<select>` styled like `Input`. Native on purpose: it keeps keyboard support, screen
 * reader announcements, and the platform picker on mobile for free. The wrapper only supplies the
 * chevron, so the control itself stays a plain form element.
 */
const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative inline-flex w-full">
      <select
        ref={ref}
        className={cn(
          'h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-background py-3 pl-4 pr-10 text-base ring-offset-background transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-input aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
);
Select.displayName = 'Select';

export { Select };
