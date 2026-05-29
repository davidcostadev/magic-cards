import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, GraduationCap, Code, Database, Component, GitBranch } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { CardList } from "@/components/features/cards/CardList";
import { CardForm } from "@/components/features/cards/CardForm";
import { mockSubjects, mockCards as initialCards } from "@/mocks/data";
import type { Card } from "@/mocks/types";

const iconMap: Record<string, React.ElementType> = {
  code: Code,
  database: Database,
  component: Component,
  "git-branch": GitBranch,
};

export function SubjectDetailPage() {
  const { subjectId } = useParams({ from: "/subjects/$subjectId" });
  const { t } = useTranslation();
  const subject = mockSubjects.find((s) => s.id === subjectId);
  const [cards, setCards] = useState<Card[]>(
    initialCards.filter((c) => c.subjectId === subjectId)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  if (!subject) {
    return (
      <div className="p-5 text-center">
        <p className="text-lg text-muted-foreground">Subject not found</p>
      </div>
    );
  }

  const Icon = iconMap[subject.icon] ?? Code;

  const handleSave = (data: Pick<Card, "type" | "language" | "question" | "answer" | "hints" | "tags" | "choices">) => {
    if (editingCard) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === editingCard.id
            ? { ...c, ...data, updatedAt: new Date().toISOString() }
            : c
        )
      );
    } else {
      const newCard: Card = {
        id: `card-${Date.now()}`,
        subjectId,
        ...data,
        shortAnswer: "",
        matchPairs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCards((prev) => [...prev, newCard]);
    }
    setEditingCard(null);
  };

  return (
    <div className="p-5 md:p-7">
      <div className="mb-7">
        <Link to="/subjects" className="inline-flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground mb-5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <ArrowLeft className="h-5 w-5" />
          {t("common.back")}
        </Link>
        <div className="flex items-center gap-4 mb-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate sm:text-3xl">{subject.title}</h1>
            <p className="text-sm text-muted-foreground line-clamp-2 sm:text-base">{subject.description}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => { setEditingCard(null); setFormOpen(true); }}
          >
            <Plus className="mr-2 h-5 w-5" />
            {t("cards.createCard")}
          </Button>
          {cards.length > 0 && (
            <Link
              to="/learn/$subjectId"
              params={{ subjectId }}
              className={cn(buttonVariants(), "hidden sm:inline-flex")}
            >
              <GraduationCap className="mr-2 h-5 w-5" />
              {t("cards.startStudying")}
            </Link>
          )}
        </div>
      </div>

      <CardList
        cards={cards}
        onEdit={(card) => { setEditingCard(card); setFormOpen(true); }}
        onDelete={(id) => setCards((prev) => prev.filter((c) => c.id !== id))}
      />

      <CardForm
        open={formOpen}
        onOpenChange={setFormOpen}
        card={editingCard}
        onSave={handleSave}
      />

      {cards.length > 0 && (
        <Link
          to="/learn/$subjectId"
          params={{ subjectId }}
          className={cn(
            buttonVariants({ size: "sm" }),
            "fixed bottom-20 right-5 z-40 shadow-lg sm:hidden"
          )}
        >
          <GraduationCap className="mr-2 h-5 w-5" />
          {t("cards.startStudying")}
        </Link>
      )}
    </div>
  );
}
