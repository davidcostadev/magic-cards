import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeCard, pickTranslation } from '@/api/queries/cards';
import type { Grade } from '@/api/queries/reviews';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { useLearningSessions } from '@/context/LearningContext';
import { cn } from '@/utils/cn';
import { isInteractiveTarget, isTypingTarget } from '@/utils/keyboard';
import { CardPart } from './CardPart';
import { MarkdownContent } from './MarkdownContent';
import type { CardReviewProps } from './reviewTypes';
import { useReviewSession } from './useReviewSession';

const TIMER_SECONDS = 60;
/** How many pairs are visible at once; solving one refills from the rest. */
const WINDOW = 4;

type Pair = { left: string; right: string };

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface Board {
  lefts: string[];
  rights: string[];
  queue: Pair[];
}

function initBoard(pairs: Pair[]): Board {
  const shuffled = shuffle(pairs);
  const head = shuffled.slice(0, WINDOW);
  return {
    lefts: head.map((p) => p.left),
    rights: shuffle(head.map((p) => p.right)),
    queue: shuffled.slice(WINDOW),
  };
}

/**
 * Tap-to-match: pick a left and a right (either order); a correct pair flashes green and is
 * removed (refilled from the remaining pairs), a wrong one flashes red and stays. The card
 * completes once every pair is matched. Validation is client-side — the server still records
 * the review and SM-2 grade on submit.
 */
export function MatchReview({
  card,
  cardLanguage = 'all',
  currentIndex,
  totalCards,
  dailyGoalProgress,
  dailyGoal,
  onSubmit,
  onAdvance,
}: CardReviewProps) {
  const { t } = useTranslation();
  const { exitRequested, overlayOpen } = useLearningSessions();
  const { question } = localizeCard(card, cardLanguage);

  const pairs: Pair[] = useMemo(() => card.matchPairs ?? [], [card.matchPairs]);
  const solution = useMemo(() => new Map(pairs.map((p) => [p.left, p.right])), [pairs]);
  const total = pairs.length;

  const [board, setBoard] = useState<Board>(() => initBoard(pairs));
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [selRight, setSelRight] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ left: string; right: string; ok: boolean } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [grade, setGrade] = useState<Grade | null>(null);
  // Set when the submit fails (network / expired token / server error). The grade lives on the
  // server, so on failure there is nothing to reveal — never fabricate one; offer a retry instead.
  const [submitError, setSubmitError] = useState(false);

  const answered = grade !== null;
  // Explanation in the learner's card language (post-answer); falls back to the primary.
  const gradeTr = grade ? pickTranslation(grade.translations, cardLanguage) : undefined;
  const explanation = gradeTr?.answer?.trim() ? gradeTr.answer : (grade?.explanation ?? '');
  const locked = flash !== null || answered;
  const solved = total - (board.lefts.length + board.queue.length);

  const boardRef = useRef(board);
  boardRef.current = board;
  const mistakesRef = useRef(0);
  const finalizedRef = useRef(false);

  const { elapsedMs } = useReviewSession({
    currentIndex,
    totalCards,
    dailyGoalProgress,
    dailyGoal,
    seconds: TIMER_SECONDS,
    active: !answered,
    onTimeout: () => finalize(),
  });

  // Submits the matched pairs (all of them on completion, the solved subset on timeout) so the
  // server records the review and the authoritative SM-2 grade. Runs at most once.
  async function finalize() {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setSubmitError(false);
    const b = boardRef.current;
    const remaining = new Set([...b.lefts, ...b.queue.map((p) => p.left)]);
    const matched = pairs.filter((p) => !remaining.has(p.left));
    const result = await onSubmit({
      response: { type: 'match', pairs: matched },
      wasHintUsed: mistakesRef.current > 0,
      timeSpentMs: Math.round(elapsedMs()),
    });
    // No grade means the submission failed. Don't fabricate a verdict (which would hide the real
    // pairing the server never sent) — reopen finalize so the learner can retry the submit.
    if (!result) {
      finalizedRef.current = false;
      setSubmitError(true);
      return;
    }
    setGrade(result);
  }

  // When every pair is matched, finalize the card.
  useEffect(() => {
    if (!answered && board.lefts.length === 0 && board.queue.length === 0 && total > 0) {
      void finalize();
    }
  }, [board, answered, total]);

  const evaluate = (left: string, right: string) => {
    setSelLeft(null);
    setSelRight(null);
    const correct = solution.get(left) === right;
    setFlash({ left, right, ok: correct });
    if (!correct) {
      mistakesRef.current += 1;
      setMistakes(mistakesRef.current);
    }
    window.setTimeout(
      () => {
        if (correct) {
          setBoard((b) => {
            const lefts = b.lefts.filter((l) => l !== left);
            const rights = b.rights.filter((r) => r !== right);
            let queue = b.queue;
            if (queue.length > 0) {
              const [next, ...rest] = queue;
              lefts.push(next.left);
              rights.splice(Math.floor(Math.random() * (rights.length + 1)), 0, next.right);
              queue = rest;
            }
            return { lefts, rights, queue };
          });
        }
        setFlash(null);
      },
      correct ? 350 : 600
    );
  };

  const pickLeft = (left: string) => {
    if (locked) return;
    if (selRight) evaluate(left, selRight);
    else setSelLeft((prev) => (prev === left ? null : left));
  };

  const pickRight = (right: string) => {
    if (locked) return;
    if (selLeft) evaluate(selLeft, right);
    else setSelRight((prev) => (prev === right ? null : right));
  };

  // Keyboard: numbers pick a left, letters pick a right; Enter advances once graded.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (exitRequested || overlayOpen || isTypingTarget(e.target)) return;
      if (answered) {
        if ((e.key === 'Enter' || e.key === ' ') && !isInteractiveTarget(document.activeElement)) {
          e.preventDefault();
          onAdvance(grade.correct);
        }
        return;
      }
      if (locked) return;
      if (/^[1-9]$/.test(e.key)) {
        const left = board.lefts[Number(e.key) - 1];
        if (left) {
          e.preventDefault();
          pickLeft(left);
        }
        return;
      }
      const letter = e.key.toLowerCase();
      if (/^[a-z]$/.test(letter)) {
        const right = board.rights[letter.charCodeAt(0) - 97];
        if (right) {
          e.preventDefault();
          pickRight(right);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const tileClass = (value: string, side: 'left' | 'right', selected: boolean) => {
    if (flash && (side === 'left' ? flash.left : flash.right) === value) {
      return flash.ok
        ? 'border-success bg-success text-white'
        : 'border-destructive bg-destructive text-white';
    }
    if (selected) return 'border-primary bg-primary text-primary-foreground cursor-pointer';
    return 'border-border bg-secondary hover:border-primary cursor-pointer';
  };

  const tileBase =
    'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left text-sm font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:active:scale-100 disabled:cursor-not-allowed';

  if (answered) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <CardPart part="question">
          <MarkdownContent text={question} />
        </CardPart>
        <div className="space-y-3 animate-[fadeIn_200ms_ease-in]">
          <p
            className={cn(
              'text-center text-base font-semibold',
              grade.correct ? 'text-success' : 'text-destructive'
            )}
          >
            {grade.correct
              ? mistakes === 0
                ? t('learn.perfectMatch')
                : t('learn.allMatched')
              : t('learn.incorrect')}
          </p>
          {!grade.correct && grade.correctPairs && (
            <div className="rounded-2xl border-2 border-success/40 bg-success/10 p-4 space-y-1">
              <p className="text-sm font-medium">{t('learn.correctAnswer')}</p>
              {grade.correctPairs.map((p) => (
                <p key={p.left} className="text-sm">
                  <span className="font-semibold">{p.left}</span> → {p.right}
                </p>
              ))}
            </div>
          )}
          {explanation && (
            <CardPart part="explanation">
              <MarkdownContent text={explanation} />
            </CardPart>
          )}
          <Button
            onClick={() => onAdvance(grade.correct)}
            className="w-full"
            size="lg"
            aria-keyshortcuts="Enter"
          >
            {t('learn.nextCard')}
            <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <CardPart part="question">
        <MarkdownContent text={card.question} />
      </CardPart>

      <p className="text-sm text-muted-foreground">
        {solved}/{total} {t('learn.matchPairsFound')}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2.5">
          {board.lefts.map((left, index) => (
            <button
              key={left}
              type="button"
              onClick={() => pickLeft(left)}
              disabled={locked}
              aria-pressed={selLeft === left}
              aria-keyshortcuts={index < 9 ? String(index + 1) : undefined}
              className={cn(tileBase, tileClass(left, 'left', selLeft === left))}
            >
              {index < 9 && (
                <span aria-hidden="true">
                  <Kbd className="h-7 w-7 shrink-0 text-xs">{index + 1}</Kbd>
                </span>
              )}
              <span>{left}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          {board.rights.map((right, index) => (
            <button
              key={right}
              type="button"
              onClick={() => pickRight(right)}
              disabled={locked}
              aria-pressed={selRight === right}
              aria-keyshortcuts={index < 26 ? String.fromCharCode(65 + index) : undefined}
              className={cn(tileBase, tileClass(right, 'right', selRight === right))}
            >
              {index < 26 && (
                <span aria-hidden="true">
                  <Kbd className="h-7 w-7 shrink-0 text-xs">{String.fromCharCode(65 + index)}</Kbd>
                </span>
              )}
              <span>{right}</span>
            </button>
          ))}
        </div>
      </div>

      {submitError && (
        <div className="space-y-3">
          <p role="alert" className="text-center text-sm font-medium text-destructive">
            {t('learn.submitError')}
          </p>
          <Button onClick={() => void finalize()} className="w-full" size="lg">
            {t('learn.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
