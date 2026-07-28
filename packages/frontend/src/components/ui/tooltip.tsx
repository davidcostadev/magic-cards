import { Info } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { cn } from '@/utils/cn';

interface InfoTooltipProps {
  /** What the tooltip explains — also the trigger's accessible name ("What is X?"). */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * A small "what is this?" hint attached to a stat or a field label. The trigger is a real button,
 * so it opens on hover *and* on keyboard focus (and on tap, which focuses it). The bubble is only
 * faded out rather than hidden, so `aria-describedby` still announces it to screen readers.
 */
export function InfoTooltip({ label, children, className }: InfoTooltipProps) {
  const id = useId();

  return (
    <span className={cn('group relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Info className="h-4 w-4" />
      </button>
      {/* Pinned above the trigger on wider screens; on mobile it docks to the bottom of the
          viewport instead, where it can never be clipped by the edge of the screen. */}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-30 rounded-xl border bg-popover p-3 text-left text-sm font-normal leading-snug text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:absolute sm:inset-x-auto sm:bottom-full sm:left-1/2 sm:mb-2 sm:w-64 sm:-translate-x-1/2"
      >
        {children}
      </span>
    </span>
  );
}
