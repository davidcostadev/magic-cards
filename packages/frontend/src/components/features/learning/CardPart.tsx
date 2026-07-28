import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The named pieces a card is made of. Keep in sync with the `learn.part.*` i18n keys.
 * `yourAnswer` is what the learner typed; `answer` is the card's own answer/explanation.
 */
export type CardPartName =
  | 'question'
  | 'hints'
  | 'options'
  | 'pairs'
  | 'yourAnswer'
  | 'answer'
  | 'explanation'
  | 'stats';

interface CardPartProps {
  part: CardPartName;
  children: ReactNode;
  className?: string;
}

/**
 * Wraps one piece of a card in a labelled region.
 *
 * On screen the card reads as a continuous flow, which loses the structure a sighted learner gets
 * from layout alone: which block is the question, which are the options, which is the explanation.
 * This names each piece via a visually hidden heading, so the region is announced and reachable by
 * heading navigation. `data-card-part` mirrors the same name in the DOM, which is what you read in
 * devtools (and what tests assert on) when a card renders oddly.
 */
export function CardPart({ part, children, className }: CardPartProps) {
  const { t } = useTranslation();
  const headingId = `card-part-${part}-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <section aria-labelledby={headingId} data-card-part={part} className={className}>
      <h3 id={headingId} className="sr-only">
        {t(`learn.part.${part}`)}
      </h3>
      {children}
    </section>
  );
}
