import { AlertTriangle, Check, Lightbulb, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/api/queries/cards';
import { type ReportReason, useCreateReport } from '@/api/queries/reports';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';

interface ReportCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null;
}

const REASONS: { value: ReportReason; labelKey: string; icon: typeof AlertTriangle }[] = [
  { value: 'incorrect', labelKey: 'reports.reasonIncorrect', icon: AlertTriangle },
  { value: 'improvement', labelKey: 'reports.reasonImprovement', icon: Lightbulb },
];

const SUCCESS_DISMISS_MS = 1500;

/**
 * Bottom sheet (mobile) / modal (desktop) for flagging a card as wrong or improvable. Picks a
 * reason, takes an optional note, submits, then shows a brief confirmation and auto-dismisses.
 */
export function ReportCardSheet({ open, onOpenChange, card }: ReportCardSheetProps) {
  const { t } = useTranslation();
  const createReport = useCreateReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Reset the form whenever a different card is opened.
  useEffect(() => {
    if (open) {
      setReason(null);
      setMessage('');
      setSubmitted(false);
    }
  }, [open, card?.id]);

  // Auto-close the success confirmation so the learner returns to studying.
  useEffect(() => {
    if (!submitted) return;
    const id = setTimeout(() => onOpenChange(false), SUCCESS_DISMISS_MS);
    return () => clearTimeout(id);
  }, [submitted, onOpenChange]);

  if (!card) return null;

  const handleSubmit = async () => {
    if (!reason) return;
    try {
      await createReport.mutateAsync({
        cardId: card.id,
        reason,
        message: message.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      // The inline error below is shown via createReport.isError.
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} autoFocus={false}>
      <SheetContent>
        {submitted ? (
          <div
            className="flex flex-col items-center gap-3 py-6 text-center"
            role="status"
            aria-live="polite"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="h-7 w-7" />
            </span>
            <p className="text-lg font-semibold">{t('reports.success')}</p>
          </div>
        ) : (
          <>
            <SheetHeader className="flex-row items-center justify-between">
              <SheetTitle>{t('reports.title')}</SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.close')}
                className="-mr-1 h-10 w-10 shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </SheetHeader>

            <fieldset
              aria-label={t('reports.title')}
              className="mt-5 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2"
            >
              {REASONS.map(({ value, labelKey, icon: Icon }) => {
                const selected = reason === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setReason(value)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-left text-base font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      selected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-input bg-background text-foreground hover:border-primary/50 hover:bg-accent'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        selected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    {t(labelKey)}
                  </button>
                );
              })}
            </fieldset>

            <div className="mt-5 space-y-2">
              <Label htmlFor="report-message">{t('reports.message')}</Label>
              <Textarea
                id="report-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('reports.messagePlaceholder')}
                maxLength={2000}
              />
            </div>

            {createReport.isError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {t('errors.internal')}
              </p>
            )}

            <SheetFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={!reason || createReport.isPending}>
                {t('reports.submit')}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
