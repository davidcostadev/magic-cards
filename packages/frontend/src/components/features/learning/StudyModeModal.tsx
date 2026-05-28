import { useTranslation } from "react-i18next";
import { BookOpen, ListChecks, Layers, Keyboard, Link2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

export type StudyMode = "all" | "flashcards" | "quizzes" | "type-answer" | "match";

const LANG_LABELS: Record<string, string> = {
  en: "English",
  pt: "Português",
};

interface StudyModeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: StudyMode) => void;
  flashcardCount: number;
  quizCount: number;
  typeAnswerCount: number;
  matchCount: number;
  availableLanguages: string[];
  selectedLanguage: string | null;
  onLanguageChange: (lang: string | null) => void;
}

export function StudyModeModal({
  open,
  onSelect,
  flashcardCount,
  quizCount,
  typeAnswerCount,
  matchCount,
  availableLanguages,
  selectedLanguage,
  onLanguageChange,
}: StudyModeModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

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

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <h2 className="mb-2 text-3xl font-bold text-center">{t("learn.chooseMode")}</h2>
      <p className="mb-6 text-lg text-muted-foreground text-center">
        {t("learn.modeCardCount", { count: totalCount })}
      </p>

      {availableLanguages.length > 1 && (
        <div className="flex items-center gap-2 mb-6">
          <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex gap-2">
            <Button
              variant={selectedLanguage === null ? "default" : "outline"}
              size="sm"
              onClick={() => onLanguageChange(null)}
            >
              {t("learn.allLanguages")}
            </Button>
            {availableLanguages.map((lang) => (
              <Button
                key={lang}
                variant={selectedLanguage === lang ? "default" : "outline"}
                size="sm"
                onClick={() => onLanguageChange(lang)}
              >
                {LANG_LABELS[lang] ?? lang}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid w-full max-w-md gap-4">
        {modes.map(({ mode, icon: Icon, label, count, bgColor, cardBg, borderColor }) => (
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
            <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl shrink-0 text-white", bgColor)}>
              <Icon className="h-7 w-7" />
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
