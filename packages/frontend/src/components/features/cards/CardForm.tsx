import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, GripVertical, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/utils/cn";
import type { Card, CardType, Choice } from "@/mocks/types";

interface CardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: Card | null;
  onSave: (data: {
    type: CardType;
    question: string;
    answer: string;
    hints: string[];
    tags: string[];
    choices: Choice[];
  }) => void;
}

export function CardForm({ open, onOpenChange, card, onSave }: CardFormProps) {
  const { t } = useTranslation();
  const [cardType, setCardType] = useState<CardType>("open");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [choices, setChoices] = useState<Choice[]>([]);

  useEffect(() => {
    if (card) {
      setCardType(card.type);
      setQuestion(card.question);
      setAnswer(card.answer);
      setHints([...card.hints]);
      setTags([...card.tags]);
      setChoices([...card.choices]);
    } else {
      setCardType("open");
      setQuestion("");
      setAnswer("");
      setHints([]);
      setTags([]);
      setChoices([]);
    }
    setTagInput("");
  }, [card, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      type: cardType,
      question,
      answer,
      hints: cardType === "open" ? hints.filter(Boolean) : [],
      tags,
      choices: cardType === "quiz" ? choices : [],
    });
    onOpenChange(false);
  };

  const addHint = () => setHints([...hints, ""]);
  const updateHint = (index: number, value: string) => {
    const updated = [...hints];
    updated[index] = value;
    setHints(updated);
  };
  const removeHint = (index: number) => setHints(hints.filter((_, i) => i !== index));

  const addChoice = () => {
    setChoices([...choices, { id: `new-${Date.now()}`, text: "", isCorrect: false }]);
  };
  const updateChoice = (index: number, text: string) => {
    const updated = [...choices];
    updated[index] = { ...updated[index], text };
    setChoices(updated);
  };
  const toggleCorrect = (index: number) => {
    setChoices(choices.map((c, i) => ({ ...c, isCorrect: i === index })));
  };
  const removeChoice = (index: number) => setChoices(choices.filter((_, i) => i !== index));

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };
  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? t("cards.editCard") : t("cards.createCard")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Label>{t("cards.cardType")}</Label>
            <div className="flex gap-3">
              {([
                { value: "open" as const, label: t("cards.typeOpen") },
                { value: "quiz" as const, label: t("cards.typeQuiz") },
              ]).map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={cardType === value ? "default" : "outline"}
                  onClick={() => setCardType(value)}
                  className="flex-1"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="question">{t("cards.question")}</Label>
            <Textarea
              id="question"
              rows={4}
              placeholder="Supports **Markdown** and ```code blocks```"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          {cardType === "open" && (
            <>
              <div className="space-y-2.5">
                <Label htmlFor="answer">{t("cards.answer")}</Label>
                <Textarea
                  id="answer"
                  rows={4}
                  placeholder="Supports **Markdown** and ```code blocks```"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label>{t("cards.hints")}</Label>
                  <Button type="button" variant="ghost" onClick={addHint}>
                    <Plus className="mr-1.5 h-5 w-5" />
                    {t("cards.addHint")}
                  </Button>
                </div>
                <div className="space-y-2.5">
                  {hints.map((hint, index) => (
                    <div key={index} className="flex items-center gap-2.5">
                      <GripVertical className="h-5 w-5 text-muted-foreground shrink-0" />
                      <Input
                        value={hint}
                        onChange={(e) => updateHint(index, e.target.value)}
                        placeholder={`Hint ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => removeHint(index)}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {cardType === "quiz" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label>{t("cards.choices")}</Label>
                {choices.length < 4 && (
                  <Button type="button" variant="ghost" onClick={addChoice}>
                    <Plus className="mr-1.5 h-5 w-5" />
                    {t("cards.addChoice")}
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{t("cards.choicesHelp")}</p>
              <div className="space-y-2.5">
                {choices.map((choice, index) => (
                  <div key={choice.id} className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(index)}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        choice.isCorrect
                          ? "border-success bg-success text-white"
                          : "border-border hover:border-success/50"
                      )}
                    >
                      {choice.isCorrect && <Check className="h-4 w-4" />}
                    </button>
                    <Input
                      value={choice.text}
                      onChange={(e) => updateChoice(index, e.target.value)}
                      placeholder={`${t("cards.choice")} ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => removeChoice(index)}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="explanation">{t("cards.explanation")}</Label>
                <Textarea
                  id="explanation"
                  rows={2}
                  placeholder={t("cards.explanationPlaceholder")}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <Label>{t("cards.tags")}</Label>
            <div className="flex gap-2.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type and press Enter"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                {t("cards.addTag")}
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
                    <button type="button" onClick={() => removeTag(tag)}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
