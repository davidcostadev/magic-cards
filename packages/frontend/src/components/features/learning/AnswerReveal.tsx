import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/common/Kbd";
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
      <Button onClick={onReveal} className="w-full" size="lg" aria-keyshortcuts="Enter Space">
        <Eye className="mr-2 h-6 w-6" />
        {t("learn.revealAnswer")}
        <Kbd className="ml-2">{t("learn.keyEnter")}</Kbd>
      </Button>
    );
  }

  return (
    <div className="animate-[slideDown_300ms_ease-out]">
      <MarkdownContent text={answer} />
    </div>
  );
}
