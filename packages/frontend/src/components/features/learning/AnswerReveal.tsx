import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MarkdownContent } from "./MarkdownContent";
import { Eye } from "lucide-react";

interface AnswerRevealProps {
  answer: string;
  revealed: boolean;
  onReveal: () => void;
}

export function AnswerReveal({ answer, revealed, onReveal }: AnswerRevealProps) {
  const { t } = useTranslation();

  if (!revealed) {
    return (
      <Button onClick={onReveal} className="w-full" size="lg">
        <Eye className="mr-2 h-6 w-6" />
        {t("learn.revealAnswer")}
      </Button>
    );
  }

  return (
    <div className="animate-[slideDown_300ms_ease-out]">
      <MarkdownContent text={answer} />
    </div>
  );
}
