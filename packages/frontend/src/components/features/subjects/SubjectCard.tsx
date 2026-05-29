import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MoreVertical, Pencil, Trash2, Code, Database, Component, GitBranch, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import type { Subject } from "@/mocks/types";
import { useState, useRef, useEffect } from "react";

const iconMap: Record<string, React.ElementType> = {
  code: Code,
  database: Database,
  component: Component,
  "git-branch": GitBranch,
};

interface SubjectCardProps {
  subject: Subject;
  cardCount: number;
  onEdit: (subject: Subject) => void;
  onDelete: (id: string) => void;
}

export function SubjectCard({ subject, cardCount, onEdit, onDelete }: SubjectCardProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = iconMap[subject.icon] ?? Code;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menuOpen) firstItemRef.current?.focus();
  }, [menuOpen]);

  const closeMenu = (returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <div className="absolute right-3 top-3">
        <div className="relative">
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            aria-label={t("common.options")}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            className="h-10 w-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => closeMenu()} />
              <div
                role="menu"
                aria-label={t("common.options")}
                className="absolute right-0 z-20 mt-1 w-44 rounded-xl border bg-popover p-1.5 shadow-md"
                onKeyDown={(e) => { if (e.key === "Escape") closeMenu(true); }}
              >
                <button
                  ref={firstItemRef}
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-base transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => { onEdit(subject); closeMenu(); }}
                >
                  <Pencil className="h-5 w-5" />
                  {t("common.edit")}
                </button>
                <button
                  role="menuitem"
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-base text-destructive transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  onClick={() => { onDelete(subject.id); closeMenu(); }}
                >
                  <Trash2 className="h-5 w-5" />
                  {t("common.delete")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <Link
        to="/subjects/$subjectId"
        params={{ subjectId: subject.id }}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <CardHeader className="p-5 pb-2.5">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold truncate">{subject.title}</h3>
              <Badge variant="secondary" className="mt-1">
                {t("subjects.cardCount", { count: cardCount })}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2">{subject.description}</p>
        </CardContent>
      </Link>
      {cardCount > 0 && (
        <div className="px-5 pb-5">
          <Link
            to="/learn/$subjectId"
            params={{ subjectId: subject.id }}
            className={cn(buttonVariants({ size: "sm" }), "w-full")}
          >
            <GraduationCap className="mr-2 h-5 w-5" />
            {t("cards.startStudying")}
          </Link>
        </div>
      )}
    </Card>
  );
}
