import { MatchReview } from './MatchReview';
import { OpenReview } from './OpenReview';
import { QuizReview } from './QuizReview';
import type { CardReviewProps } from './reviewTypes';
import { TypeAnswerReview } from './TypeAnswerReview';

export type { CardReviewProps, ReviewSubmission } from './reviewTypes';

/** Dispatches a card to the review UI for its type (architecture §4 card types). */
export function CardReview(props: CardReviewProps) {
  switch (props.card.type) {
    case 'quiz':
      return <QuizReview {...props} />;
    case 'type-answer':
      return <TypeAnswerReview {...props} />;
    case 'match':
      return <MatchReview {...props} />;
    default:
      return <OpenReview {...props} />;
  }
}
