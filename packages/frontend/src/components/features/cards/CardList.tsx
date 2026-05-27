import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Card as CardType } from "@/mocks/types";

interface CardListProps {
  cards: CardType[];
  onEdit: (card: CardType) => void;
  onDelete: (id: string) => void;
}

export function CardList({ cards, onEdit, onDelete }: CardListProps) {
  const { t } = useTranslation();

  if (cards.length === 0) {
    return (
      <p className="py-10 text-center text-lg text-muted-foreground">
        {t("cards.noCards")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <Card key={card.id} className="group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <p className="text-base font-semibold line-clamp-2">
                    {card.question.split("\n")[0].replace(/[#`*]/g, "")}
                  </p>
                  {card.type === "quiz" && (
                    <Badge variant="default" className="shrink-0">Quiz</Badge>
                  )}
                </div>
                {card.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {card.hints.length > 0 && (
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {card.hints.length} {card.hints.length === 1 ? "hint" : "hints"}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(card)}>
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive"
                  onClick={() => onDelete(card.id)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
