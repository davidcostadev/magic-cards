import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ListChecks, Layers, Keyboard, Link2 } from "lucide-react";
import { Kbd } from "@/components/common/Kbd";
import { isTypingTarget } from "@/utils/keyboard";
import { cn } from "@/utils/cn";

export type StudyMode = "all" | "flashcards" | "quizzes" | "type-answer" | "match";

interface StudyModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: StudyMode) => void;
  flashcardCount: number;
  quizCount: number;
  typeAnswerCount: number;
  matchCount: number;
}

export function StudyModeModal({
  open,
  onSelect,
  flashcardCount,
  quizCount,
  typeAnswerCount,
  matchCount,
}: StudyModeModalProps) {
  const { t } = useTranslation();
  const firstEnabledRef = useRef<HTMLButtonElement>(null);

  const totalCount = flashcardCount + quizCount + typeAnswerCount + matchCount;

  const modes = [
    {
      mode: "flashcards" as const,
      icon: BookOpen,
      label: t("learn.modeFlashcards"),
      count: flashcardCount,
      bgColor: "bg-blue-500",
      cardBg: "bg-blue-500/15 hover:bg-blue-500/25",
      borderColor: "border-blue-500/30 hover:border-blue-500",
    },
    {
      mode: "quizzes" as const,
      icon: ListChecks,
      label: t("learn.modeQuizzes"),
      count: quizCount,
      bgColor: "bg-purple-500",
      cardBg: "bg-purple-500/15 hover:bg-purple-500/25",
      borderColor: "border-purple-500/30 hover:border-purple-500",
    },
    {
      mode: "type-answer" as const,
      icon: Keyboard,
      label: t("learn.modeTypeAnswer"),
      count: typeAnswerCount,
      bgColor: "bg-emerald-500",
      cardBg: "bg-emerald-500/15 hover:bg-emerald-500/25",
      borderColor: "border-emerald-500/30 hover:border-emerald-500",
    },
    {
      mode: "match" as const,
      icon: Link2,
      label: t("learn.modeMatch"),
      count: matchCount,
      bgColor: "bg-amber-500",
      cardBg: "bg-amber-500/15 hover:bg-amber-500/25",
      borderColor: "border-amber-500/30 hover:border-amber-500",
    },
    {
      mode: "all" as const,
      icon: Layers,
      label: t("learn.modeAll", { count: totalCount }),
      count: totalCount,
      bgColor: "bg-primary",
      cardBg: "bg-primary/15 hover:bg-primary/25",
      borderColor: "border-primary/30 hover:border-primary",
    },
  ];

  // Press 1-5 to pick a study mode without reaching for the mouse.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const index = Number(e.key) - 1;
      const target = modes[index];
      if (target && target.count > 0) {
        e.preventDefault();
        onSelect(target.mode);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, modes, onSelect]);

  // Move focus to the first available mode so keyboard users land inside the list.
  useEffect(() => {
    if (open) firstEnabledRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const firstEnabledIndex = modes.findIndex((m) => m.count > 0);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <h2 className="mb-2 text-3xl font-bold text-center">{t("learn.chooseMode")}</h2>
      <p className="mb-6 text-lg text-muted-foreground text-center">
        {t("learn.modeCardCount", { count: totalCount })}
      </p>

      <div className="grid w-full max-w-md gap-4">
        {modes.map(({ mode, icon: Icon, label, count, bgColor, cardBg, borderColor }, index) => (
          <button
            key={mode}
            ref={index === firstEnabledIndex ? firstEnabledRef : undefined}
            onClick={() => onSelect(mode)}
            disabled={count === 0}
            aria-keyshortcuts={count > 0 ? String(index + 1) : undefined}
            className={cn(
              "flex cursor-pointer items-center gap-5 rounded-2xl border-2 p-6 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
              cardBg,
              borderColor
            )}
          >
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl shrink-0 text-white", bgColor)}>
              <Icon className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <span className="text-lg font-bold">{label}</span>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("learn.modeCardCount", { count })}
              </p>
            </div>
            {count > 0 && <Kbd className="text-foreground/70">{index + 1}</Kbd>}
          </button>
        ))}
      </div>
    </div>
  );
}
