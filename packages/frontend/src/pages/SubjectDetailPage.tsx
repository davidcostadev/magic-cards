import { useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Plus, GraduationCap } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { CardList } from "@/components/features/cards/CardList";
import { CardForm, type CardFormData } from "@/components/features/cards/CardForm";
import { getSubjectIcon } from "@/components/features/subjects/subjectIcons";
import { useSubject } from "@/api/queries/subjects";
import { type Card, useCards, useCreateCard, useDeleteCard, useUpdateCard } from "@/api/queries/cards";

export function SubjectDetailPage() {
  const { subjectId } = useParams({ from: "/subjects/$subjectId" });
  const { t } = useTranslation();
  const { data: subject, isLoading: subjectLoading, isError } = useSubject(subjectId);
  const { data: cards = [] } = useCards(subjectId);
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  if (subjectLoading) {
    return (
      <div className="p-5 md:p-7 space-y-5">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }
  if (isError || !subject) {
    return (
      <div className="p-5 text-center">
        <p className="text-lg text-muted-foreground">{t("errors.notFound")}</p>
        <Link to="/subjects" className="mt-3 inline-block text-primary hover:underline">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  const Icon = getSubjectIcon(subject.icon ?? "code");
  const color = subject.color ?? "#6366f1";

  const handleSave = (data: CardFormData) => {
    if (editingCard) {
      updateCard.mutate({ id: editingCard.id, body: data });
    } else {
      createCard.mutate({ subjectId, ...data });
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
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate sm:text-3xl">{subject.title}</h1>
            <p className="text-sm text-muted-foreground line-clamp-2 sm:text-base">
              {subject.description ?? ""}
            </p>
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
        onDelete={(id) => deleteCard.mutate({ id, subjectId })}
      />

      <CardForm
        open={formOpen}
        onOpenChange={setFormOpen}
        card={editingCard}
        onSave={handleSave}
        isSubmitting={createCard.isPending || updateCard.isPending}
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
