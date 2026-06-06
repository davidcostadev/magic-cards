import { Check, Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/api/queries/cards';
import { CardStatsPanel } from '@/components/features/learning/CardStatsPanel';
import { MarkdownContent } from '@/components/features/learning/MarkdownContent';
import { LanguageBadge } from '@/components/features/subjects/LanguageBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';

const TYPE_LABEL_KEY: Record<Card['type'], string> = {
  open: 'cards.typeOpen',
  quiz: 'cards.typeQuiz',
  'type-answer': 'cards.typeTypeAnswer',
  match: 'cards.typeMatch',
};

interface CardViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null;
  /** When true, the viewer owns the subject and an Edit shortcut is offered. */
  canEdit?: boolean;
  onEdit?: () => void;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  );
}

/**
 * Read-only view of a card. Laid out as a mobile-first sheet: a fixed header (with a close
 * button) and footer bracket a single scrollable body, so the actions are always reachable on a
 * full-screen phone modal without scrolling past a long card. When the card carries
 * `translations`, the question/answer toggle between languages.
 */
export function CardView({ open, onOpenChange, card, canEdit, onEdit }: CardViewProps) {
  const { t } = useTranslation();
  // The learner's preferred card language ('all' = the card's primary).
  const cardLanguage = useAuth().user?.cardLanguage ?? 'all';
  // Selected display language. When a different card opens, default to the learner's preferred
  // language if the card has that translation; otherwise fall back to the card's primary.
  const [activeLang, setActiveLang] = useState<string | null>(null);
  useEffect(() => {
    if (!card) {
      setActiveLang(null);
      return;
    }
    const prefersTranslation =
      cardLanguage !== 'all' &&
      cardLanguage !== card.language &&
      !!card.translations?.[cardLanguage as keyof NonNullable<typeof card.translations>];
    setActiveLang(prefersTranslation ? cardLanguage : card.language);
  }, [card, cardLanguage]);

  if (!card) return null;

  const translations = card.translations ?? {};
  const at = (l: string) => translations[l as keyof typeof translations];
  const extraLangs = Object.keys(translations).filter((l) => l !== card.language && at(l));
  const langs = [card.language, ...extraLangs];
  const lang = activeLang && langs.includes(activeLang) ? activeLang : card.language;
  const localized = lang !== card.language ? at(lang) : undefined;
  const question = localized?.question ?? card.question;
  const answer = localized?.answer ?? card.answer;

  const answerLabel = card.type === 'open' ? t('cards.answer') : t('cards.explanation');
  const hasExplanation = answer.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 pb-0 sm:p-0 sm:pb-0">
        {/* Fixed header — the X is always reachable on a full-screen mobile modal. */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="secondary">{t(TYPE_LABEL_KEY[card.type])}</Badge>
            {langs.length === 1 && <LanguageBadge language={card.language} />}
            <DialogTitle className="truncate text-base font-semibold">
              {t('cards.preview')}
            </DialogTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.close')}
            className="-mr-1 h-10 w-10 shrink-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* The only scroll region. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {langs.length > 1 && (
            <fieldset
              className="mb-6 inline-flex rounded-xl border border-border bg-muted/40 p-1"
              aria-label={t('cards.language')}
            >
              {langs.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={l === lang}
                  aria-label={`${t('cards.language')}: ${l.toUpperCase()}`}
                  onClick={() => setActiveLang(l)}
                  className={cn(
                    'min-w-12 cursor-pointer rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    l === lang
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </fieldset>
          )}

          <div className="space-y-6">
            <Section label={t('cards.question')}>
              <MarkdownContent text={question} />
            </Section>

            {card.type === 'quiz' && card.choices && card.choices.length > 0 && (
              <Section label={t('cards.choices')}>
                <ul className="space-y-2">
                  {card.choices.map((choice) => (
                    <li
                      key={choice.id}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border px-4 py-3 text-base',
                        choice.isCorrect
                          ? 'border-success/50 bg-success/10 font-medium'
                          : 'border-border'
                      )}
                    >
                      {choice.isCorrect && (
                        <Check
                          className="h-5 w-5 shrink-0 text-success"
                          aria-label={t('cards.correct')}
                        />
                      )}
                      <span className="min-w-0 break-words">{choice.text}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {card.type === 'type-answer' && card.shortAnswer && (
              <Section label={t('cards.shortAnswer')}>
                <p className="break-words rounded-xl border border-success/50 bg-success/10 px-4 py-3 text-base font-medium">
                  {card.shortAnswer}
                </p>
              </Section>
            )}

            {card.type === 'match' && card.matchPairs && card.matchPairs.length > 0 && (
              <Section label={t('cards.matchPairs')}>
                <ul className="space-y-2">
                  {card.matchPairs.map((pair) => (
                    <li
                      key={`${pair.left}|${pair.right}`}
                      className="flex items-start gap-2.5 rounded-xl border border-border px-4 py-3 text-base"
                    >
                      <span className="min-w-0 break-words font-medium">{pair.left}</span>
                      <span className="shrink-0 text-muted-foreground" aria-hidden>
                        →
                      </span>
                      <span className="min-w-0 break-words">{pair.right}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {hasExplanation && (
              <Section label={answerLabel}>
                <MarkdownContent text={answer} />
              </Section>
            )}

            {card.hints.length > 0 && (
              <Section label={t('cards.hints')}>
                <ul className="list-disc space-y-1.5 pl-5">
                  {card.hints.map((hint, i) => (
                    <li key={i} className="break-words text-base text-muted-foreground">
                      {hint}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {card.tags.length > 0 && (
              <Section label={t('cards.tags')}>
                <div className="flex flex-wrap gap-1.5">
                  {card.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}

            {/* Opt-in "nerd stats": self-hides unless the preference is on. */}
            <CardStatsPanel cardId={card.id} />
          </div>
        </div>

        {/* Fixed footer — actions stay reachable regardless of card length. */}
        <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {canEdit && onEdit && (
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => {
                onOpenChange(false);
                onEdit();
              }}
            >
              <Pencil className="mr-2 h-5 w-5" />
              {t('common.edit')}
            </Button>
          )}
          <Button className="flex-1 sm:flex-none sm:ml-auto" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
