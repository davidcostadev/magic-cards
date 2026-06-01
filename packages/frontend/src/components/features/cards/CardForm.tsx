import { GripVertical, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/api/queries/cards';
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

export interface CardFormData {
  question: string;
  answer: string;
  hints: string[];
  tags: string[];
}

interface CardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Card | null;
  onSave: (data: CardFormData) => void;
  isSubmitting?: boolean;
}

export function CardForm({ open, onOpenChange, card, onSave, isSubmitting }: CardFormProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<{ question?: string; answer?: string }>({});

  useEffect(() => {
    if (card) {
      setQuestion(card.question);
      setAnswer(card.answer);
      setHints([...card.hints]);
      setTags([...card.tags]);
    } else {
      setQuestion('');
      setAnswer('');
      setHints([]);
      setTags([]);
    }
    setTagInput('');
    setErrors({});
  }, [card, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: { question?: string; answer?: string } = {};
    if (!question.trim()) next.question = t('validation.required');
    if (!answer.trim()) next.answer = t('validation.required');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave({ question, answer, hints: hints.filter((h) => h.trim()), tags });
    onOpenChange(false);
  };

  const addHint = () => setHints([...hints, '']);
  const updateHint = (index: number, value: string) => {
    const updated = [...hints];
    updated[index] = value;
    setHints(updated);
  };
  const removeHint = (index: number) => setHints(hints.filter((_, i) => i !== index));

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };
  const removeTag = (tag: string) => setTags(tags.filter((x) => x !== tag));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? t('cards.editCard') : t('cards.createCard')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="question">{t('cards.question')}</Label>
            <Textarea
              id="question"
              rows={4}
              placeholder={t('cards.markdownPlaceholder')}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                if (errors.question) setErrors((prev) => ({ ...prev, question: undefined }));
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

          <div className="space-y-2.5">
            <Label htmlFor="answer">{t('cards.answer')}</Label>
            <Textarea
              id="answer"
              rows={4}
              placeholder={t('cards.markdownPlaceholder')}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                if (errors.answer) setErrors((prev) => ({ ...prev, answer: undefined }));
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
