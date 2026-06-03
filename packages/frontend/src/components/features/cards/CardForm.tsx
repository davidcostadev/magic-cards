import { GripVertical, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, CardLanguage } from '@/api/queries/cards';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';

type CardType = Card['type'];
interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}
interface MatchPair {
  left: string;
  right: string;
}

export interface CardFormData {
  type: CardType;
  language: CardLanguage;
  question: string;
  answer: string;
  hints: string[];
  tags: string[];
  choices?: Choice[];
  shortAnswer?: string;
  matchPairs?: MatchPair[];
}

interface CardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Card | null;
  onSave: (data: CardFormData) => void;
  isSubmitting?: boolean;
}

const CARD_TYPES: CardType[] = ['open', 'quiz', 'type-answer', 'match'];
const TYPE_LABEL_KEY: Record<CardType, string> = {
  open: 'cards.typeOpen',
  quiz: 'cards.typeQuiz',
  'type-answer': 'cards.typeTypeAnswer',
  match: 'cards.typeMatch',
};
const LANGUAGES: { code: CardLanguage; labelKey: string }[] = [
  { code: 'en', labelKey: 'settings.english' },
  { code: 'pt', labelKey: 'settings.portuguese' },
];

let choiceCounter = 0;
function makeChoiceId(): string {
  choiceCounter += 1;
  return `choice-${Date.now().toString(36)}-${choiceCounter}`;
}
const emptyChoices = (): Choice[] => [
  { id: makeChoiceId(), text: '', isCorrect: true },
  { id: makeChoiceId(), text: '', isCorrect: false },
];
const emptyPairs = (): MatchPair[] => [
  { left: '', right: '' },
  { left: '', right: '' },
];

interface FormErrors {
  question?: string;
  answer?: string;
  choices?: string;
  shortAnswer?: string;
  matchPairs?: string;
}

export function CardForm({ open, onOpenChange, card, onSave, isSubmitting }: CardFormProps) {
  const { t } = useTranslation();
  const [type, setType] = useState<CardType>('open');
  const [language, setLanguage] = useState<CardLanguage>('en');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [choices, setChoices] = useState<Choice[]>(emptyChoices);
  const [shortAnswer, setShortAnswer] = useState('');
  const [matchPairs, setMatchPairs] = useState<MatchPair[]>(emptyPairs);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (card) {
      setType(card.type);
      setLanguage(card.language ?? 'en');
      setQuestion(card.question);
      setAnswer(card.answer);
      setHints([...card.hints]);
      setTags([...card.tags]);
      setChoices(
        card.choices?.length
          ? card.choices.map((c) => ({ id: c.id, text: c.text, isCorrect: c.isCorrect ?? false }))
          : emptyChoices()
      );
      setShortAnswer(card.shortAnswer ?? '');
      setMatchPairs(
        card.matchPairs?.length ? card.matchPairs.map((p) => ({ ...p })) : emptyPairs()
      );
    } else {
      setType('open');
      setLanguage('en');
      setQuestion('');
      setAnswer('');
      setHints([]);
      setTags([]);
      setChoices(emptyChoices());
      setShortAnswer('');
      setMatchPairs(emptyPairs());
    }
    setTagInput('');
    setErrors({});
  }, [card, open]);

  const clearError = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!question.trim()) next.question = t('validation.required');

    if (type === 'open' || type === 'quiz' || type === 'type-answer') {
      if (!answer.trim()) next.answer = t('validation.required');
    }
    if (type === 'quiz') {
      const filled = choices.filter((c) => c.text.trim());
      if (filled.length < 2) next.choices = t('validation.required');
      else if (filled.filter((c) => c.isCorrect).length !== 1)
        next.choices = t('validation.correctChoice');
    }
    if (type === 'type-answer' && !shortAnswer.trim()) {
      next.shortAnswer = t('validation.required');
    }
    if (type === 'match') {
      const filled = matchPairs.filter((p) => p.left.trim() && p.right.trim());
      if (filled.length < 2) next.matchPairs = t('validation.required');
    }
    return next;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).some((k) => next[k as keyof FormErrors])) return;

    const base: CardFormData = {
      type,
      language,
      question,
      answer: answer.trim(),
      hints: hints.filter((h) => h.trim()),
      tags,
    };
    if (type === 'quiz') {
      base.choices = choices
        .filter((c) => c.text.trim())
        .map((c) => ({ id: c.id, text: c.text.trim(), isCorrect: c.isCorrect }));
    } else if (type === 'type-answer') {
      base.shortAnswer = shortAnswer.trim();
    } else if (type === 'match') {
      base.matchPairs = matchPairs
        .filter((p) => p.left.trim() && p.right.trim())
        .map((p) => ({ left: p.left.trim(), right: p.right.trim() }));
    }
    onSave(base);
    onOpenChange(false);
  };

  // --- choices (quiz) ---
  const addChoice = () =>
    setChoices([...choices, { id: makeChoiceId(), text: '', isCorrect: false }]);
  const updateChoiceText = (id: string, text: string) =>
    setChoices((cs) => cs.map((c) => (c.id === id ? { ...c, text } : c)));
  const markCorrect = (id: string) =>
    setChoices((cs) => cs.map((c) => ({ ...c, isCorrect: c.id === id })));
  const removeChoice = (id: string) => setChoices((cs) => cs.filter((c) => c.id !== id));

  // --- match pairs ---
  const addPair = () => setMatchPairs([...matchPairs, { left: '', right: '' }]);
  const updatePair = (index: number, side: 'left' | 'right', value: string) =>
    setMatchPairs((ps) => ps.map((p, i) => (i === index ? { ...p, [side]: value } : p)));
  const removePair = (index: number) => setMatchPairs((ps) => ps.filter((_, i) => i !== index));

  // --- hints / tags (shared) ---
  const addHint = () => setHints([...hints, '']);
  const updateHint = (index: number, value: string) =>
    setHints((hs) => hs.map((h, i) => (i === index ? value : h)));
  const removeHint = (index: number) => setHints(hints.filter((_, i) => i !== index));
  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };
  const removeTag = (tag: string) => setTags(tags.filter((x) => x !== tag));

  const answerLabel = type === 'open' ? t('cards.answer') : t('cards.explanation');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? t('cards.editCard') : t('cards.createCard')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Card type — locked once a card exists (type is immutable on the backend). */}
          <fieldset className="space-y-2.5">
            <legend className="mb-2.5 text-sm font-medium">{t('cards.cardType')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CARD_TYPES.map((value) => {
                const active = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    disabled={!!card}
                    onClick={() => setType(value)}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary hover:border-primary',
                      card ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                    )}
                  >
                    {t(TYPE_LABEL_KEY[value])}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Content language — editable (unlike type, which is immutable). */}
          <fieldset className="space-y-2.5">
            <legend className="mb-2.5 text-sm font-medium">{t('cards.language')}</legend>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map(({ code, labelKey }) => {
                const active = language === code;
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setLanguage(code)}
                    className={cn(
                      'rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary hover:border-primary'
                    )}
                  >
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2.5">
            <Label htmlFor="question">{t('cards.question')}</Label>
            <Textarea
              id="question"
              rows={3}
              placeholder={t('cards.markdownPlaceholder')}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                clearError('question');
              }}
              aria-invalid={!!errors.question}
              aria-describedby={errors.question ? 'card-question-error' : undefined}
            />
            {errors.question && (
              <p id="card-question-error" className="text-sm text-destructive">
                {errors.question}
              </p>
            )}
          </div>

          {/* Quiz choices */}
          {type === 'quiz' && (
            <fieldset className="space-y-2.5">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">{t('cards.choices')}</legend>
                <Button type="button" variant="ghost" onClick={addChoice}>
                  <Plus className="mr-1.5 h-5 w-5" />
                  {t('cards.addChoice')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t('cards.choicesHelp')}</p>
              {choices.map((choice, index) => (
                <div key={choice.id} className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="quiz-correct"
                    checked={choice.isCorrect}
                    onChange={() => {
                      markCorrect(choice.id);
                      clearError('choices');
                    }}
                    aria-label={t('validation.correctChoice')}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <Input
                    value={choice.text}
                    onChange={(e) => {
                      updateChoiceText(choice.id, e.target.value);
                      clearError('choices');
                    }}
                    placeholder={t('cards.choicePlaceholder', { n: index + 1 })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    className="h-10 w-10 shrink-0"
                    disabled={choices.length <= 2}
                    onClick={() => removeChoice(choice.id)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ))}
              {errors.choices && <p className="text-sm text-destructive">{errors.choices}</p>}
            </fieldset>
          )}

          {/* Type-answer accepted answer */}
          {type === 'type-answer' && (
            <div className="space-y-2.5">
              <Label htmlFor="short-answer">{t('cards.shortAnswer')}</Label>
              <Input
                id="short-answer"
                value={shortAnswer}
                placeholder={t('cards.shortAnswerPlaceholder')}
                onChange={(e) => {
                  setShortAnswer(e.target.value);
                  clearError('shortAnswer');
                }}
                aria-invalid={!!errors.shortAnswer}
                aria-describedby="short-answer-help"
              />
              <p id="short-answer-help" className="text-sm text-muted-foreground">
                {t('cards.shortAnswerHelp')}
              </p>
              {errors.shortAnswer && (
                <p className="text-sm text-destructive">{errors.shortAnswer}</p>
              )}
            </div>
          )}

          {/* Match pairs */}
          {type === 'match' && (
            <fieldset className="space-y-2.5">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-medium">{t('cards.matchPairs')}</legend>
                <Button type="button" variant="ghost" onClick={addPair}>
                  <Plus className="mr-1.5 h-5 w-5" />
                  {t('cards.addPair')}
                </Button>
              </div>
              {matchPairs.map((pair, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <Input
                    value={pair.left}
                    aria-label={`${t('cards.leftItem')} ${index + 1}`}
                    placeholder={t('cards.leftItem')}
                    onChange={(e) => {
                      updatePair(index, 'left', e.target.value);
                      clearError('matchPairs');
                    }}
                  />
                  <span className="text-muted-foreground" aria-hidden>
                    →
                  </span>
                  <Input
                    value={pair.right}
                    aria-label={`${t('cards.rightItem')} ${index + 1}`}
                    placeholder={t('cards.rightItem')}
                    onChange={(e) => {
                      updatePair(index, 'right', e.target.value);
                      clearError('matchPairs');
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    className="h-10 w-10 shrink-0"
                    disabled={matchPairs.length <= 2}
                    onClick={() => removePair(index)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ))}
              {errors.matchPairs && <p className="text-sm text-destructive">{errors.matchPairs}</p>}
            </fieldset>
          )}

          {/* Answer / explanation — not shown for match (optional, omitted to keep it simple) */}
          {type !== 'match' && (
            <div className="space-y-2.5">
              <Label htmlFor="answer">{answerLabel}</Label>
              <Textarea
                id="answer"
                rows={type === 'open' ? 4 : 2}
                placeholder={
                  type === 'open'
                    ? t('cards.markdownPlaceholder')
                    : t('cards.explanationPlaceholder')
                }
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  clearError('answer');
                }}
                aria-invalid={!!errors.answer}
                aria-describedby={errors.answer ? 'card-answer-error' : undefined}
              />
              {errors.answer && (
                <p id="card-answer-error" className="text-sm text-destructive">
                  {errors.answer}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label>{t('cards.hints')}</Label>
              <Button type="button" variant="ghost" onClick={addHint}>
                <Plus className="mr-1.5 h-5 w-5" />
                {t('cards.addHint')}
              </Button>
            </div>
            <div className="space-y-2.5">
              {hints.map((hint, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                  <Input
                    value={hint}
                    onChange={(e) => updateHint(index, e.target.value)}
                    placeholder={t('cards.hintNumber', { n: index + 1 })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    className="h-10 w-10 shrink-0"
                    onClick={() => removeHint(index)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="tag-input">{t('cards.tags')}</Label>
            <div className="flex gap-2.5">
              <Input
                id="tag-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={t('cards.tagPlaceholder')}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                {t('cards.addTag')}
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      aria-label={`${t('common.delete')} ${tag}`}
                      onClick={() => removeTag(tag)}
                      className="cursor-pointer rounded-full transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
