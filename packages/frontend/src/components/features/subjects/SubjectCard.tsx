import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MoreVertical, Pencil, Trash2, Code, Database, Component, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Subject } from "@/mocks/types";
import { useState } from "react";

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

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <div className="absolute right-3 top-3">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border bg-popover p-1.5 shadow-md">
                <button
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-base hover:bg-accent"
                  onClick={() => { onEdit(subject); setMenuOpen(false); }}
                >
                  <Pencil className="h-5 w-5" />
                  {t("common.edit")}
                </button>
                <button
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-base text-destructive hover:bg-accent"
                  onClick={() => { onDelete(subject.id); setMenuOpen(false); }}
                >
                  <Trash2 className="h-5 w-5" />
                  {t("common.delete")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <Link to="/subjects/$subjectId" params={{ subjectId: subject.id }}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold truncate">{subject.title}</h3>
              <Badge variant="secondary" className="mt-1.5">
                {t("subjects.cardCount", { count: cardCount })}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-base text-muted-foreground line-clamp-2">{subject.description}</p>
        </CardContent>
      </Link>
    </Card>
  );
}
