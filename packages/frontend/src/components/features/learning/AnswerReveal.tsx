import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Kbd } from '@/components/common/Kbd';
import { Button } from '@/components/ui/button';
import { CardPart } from './CardPart';
import { MarkdownContent } from './MarkdownContent';

interface AnswerRevealProps {
  answer: string;
  revealed: boolean;
  onReveal: () => void;
}

export function AnswerReveal({ answer, revealed, onReveal }: AnswerRevealProps) {
  const { t } = useTranslation();

  if (!revealed) {
    return (
      <Button onClick={onReveal} className="w-full" size="lg" aria-keyshortcuts="Enter Space">
        <Eye className="mr-2 h-6 w-6" />
        {t('learn.revealAnswer')}
        <Kbd className="ml-2">{t('learn.keyEnter')}</Kbd>
      </Button>
    );
  }

  return (
    <CardPart part="answer" className="animate-[slideDown_300ms_ease-out]">
      <MarkdownContent text={answer} />
    </CardPart>
  );
}
