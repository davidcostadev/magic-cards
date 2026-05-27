import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HintRevealProps {
  hints: string[];
  revealedCount: number;
  onRevealNext: () => void;
}

export function HintReveal({ hints, revealedCount, onRevealNext }: HintRevealProps) {
  const { t } = useTranslation();
  const hasMore = revealedCount < hints.length;

  if (hints.length === 0) return null;

  return (
    <div className="space-y-3">
      {hints.slice(0, revealedCount).map((hint, index) => (
        <div
          key={index}
          className="flex items-start gap-3 rounded-xl bg-warning/10 border border-warning/20 px-4 py-3 animate-[fadeIn_300ms_ease-in]"
        >
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-base">{hint}</p>
        </div>
      ))}
      {hasMore && (
        <Button variant="outline" onClick={onRevealNext}>
          <Lightbulb className="mr-2 h-5 w-5" />
          {t("learn.showHint")} ({revealedCount + 1}/{hints.length})
        </Button>
      )}
    </div>
  );
}
