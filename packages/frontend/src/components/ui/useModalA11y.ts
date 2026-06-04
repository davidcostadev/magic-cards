import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalA11yOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When false, focus moves to the container instead of the first focusable control — useful
   * when the modal is driven by keyboard shortcuts and a pre-focused button would look
   * "selected". Defaults to true.
   */
  autoFocus?: boolean;
}

/**
 * Shared overlay behaviour for modal surfaces (Dialog, Sheet): scroll-lock, focus into the
 * surface on open, a Tab focus-trap, Escape to close, and focus restoration on close. Attach the
 * returned ref to the surface container. Extracted so Dialog and Sheet stay behaviourally identical.
 */
export function useModalA11y({
  open,
  onOpenChange,
  autoFocus = true,
}: ModalA11yOptions): RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const container = containerRef.current;
    const focusables = () => Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    // Move focus into the surface so keyboard users start inside it.
    if (autoFocus) {
      (focusables()[0] ?? container)?.focus();
    } else {
      container?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Focus sitting on the container (autoFocus=false) wraps to either end.
      if (active === container) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || !container?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !container?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onOpenChange, autoFocus]);

  return containerRef;
}
