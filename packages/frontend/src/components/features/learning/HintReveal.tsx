import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { CardPart } from './CardPart';

interface HintRevealProps {
  hints: string[];
  revealedCount: number;
  onRevealNext: () => void;
  shortcutKey?: string;
}

export function HintReveal({ hints, revealedCount, onRevealNext, shortcutKey }: HintRevealProps) {
  const { t } = useTranslation();
  const hasMore = revealedCount < hints.length;

  if (hints.length === 0) return null;

  return (
    <CardPart part="hints" className="space-y-3">
      {hints.slice(0, revealedCount).map((hint, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/20 px-4 py-3 animate-[fadeIn_300ms_ease-in]"
        >
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-base">{hint}</p>
        </div>
      ))}
      {hasMore && (
        <Button
          variant="outline"
          onClick={onRevealNext}
          aria-keyshortcuts={shortcutKey ? shortcutKey.trim().replace(/\s+/g, '+') : undefined}
        >
          <Lightbulb className="mr-2 h-5 w-5" />
          {t('learn.showHint')} ({revealedCount + 1}/{hints.length})
          {shortcutKey && (
            <span className="ml-2 inline-flex items-center gap-1">
              {shortcutKey
                .trim()
                .split(/\s+/)
                .map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
            </span>
          )}
        </Button>
      )}
    </CardPart>
  );
}
