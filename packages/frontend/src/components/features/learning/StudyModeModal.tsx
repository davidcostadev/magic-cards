import { useTranslation } from "react-i18next";
import { BookOpen, ListChecks, Layers } from "lucide-react";
import { cn } from "@/utils/cn";

export type StudyMode = "all" | "flashcards" | "quizzes";

interface StudyModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: StudyMode) => void;
  flashcardCount: number;
  quizCount: number;
}

export function StudyModeModal({
  open,
  onSelect,
  flashcardCount,
  quizCount,
}: StudyModeModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const modes = [
    {
      mode: "flashcards" as const,
      icon: BookOpen,
      label: t("learn.modeFlashcards"),
      count: flashcardCount,
      color: "text-white",
      bgColor: "bg-blue-500",
      cardBg: "bg-blue-500/15 hover:bg-blue-500/25",
      borderColor: "border-blue-500/30 hover:border-blue-500",
    },
    {
      mode: "quizzes" as const,
      icon: ListChecks,
      label: t("learn.modeQuizzes"),
      count: quizCount,
      color: "text-white",
      bgColor: "bg-purple-500",
      cardBg: "bg-purple-500/15 hover:bg-purple-500/25",
      borderColor: "border-purple-500/30 hover:border-purple-500",
    },
    {
      mode: "all" as const,
      icon: Layers,
      label: t("learn.modeAll", { count: flashcardCount + quizCount }),
      count: flashcardCount + quizCount,
      color: "text-white",
      bgColor: "bg-primary",
      cardBg: "bg-primary/15 hover:bg-primary/25",
      borderColor: "border-primary/30 hover:border-primary",
    },
  ];

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <h2 className="mb-2 text-3xl font-bold text-center">{t("learn.chooseMode")}</h2>
      <p className="mb-8 text-lg text-muted-foreground text-center">
        {t("learn.modeCardCount", { count: flashcardCount + quizCount })}
      </p>
      <div className="grid w-full max-w-md gap-4">
        {modes.map(({ mode, icon: Icon, label, count, color, bgColor, cardBg, borderColor }) => (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            disabled={count === 0}
            className={cn(
              "flex items-center gap-5 rounded-2xl border-2 p-6 text-left transition-all active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
              cardBg,
              borderColor
            )}
          >
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl shrink-0", bgColor)}>
              <Icon className={cn("h-7 w-7", color)} />
            </div>
            <div>
              <span className="text-lg font-bold">{label}</span>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t("learn.modeCardCount", { count })}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
