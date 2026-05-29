import { useTranslation } from "react-i18next";
import { Check, Code, Database, Component, GitBranch } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { usePreferences } from "@/context/PreferencesContext";
import type { Subject } from "@/mocks/types";

const iconMap: Record<string, React.ElementType> = {
  code: Code,
  database: Database,
  component: Component,
  "git-branch": GitBranch,
};

interface ManageSubjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: Subject[];
}

export function ManageSubjectsModal({ open, onOpenChange, subjects }: ManageSubjectsModalProps) {
  const { t } = useTranslation();
  const { isSubjectActive, toggleSubject } = usePreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("subjects.manageTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t("subjects.manageHint")}</p>
        <div className="mt-4 space-y-2.5">
          {subjects.map((subject) => {
            const Icon = iconMap[subject.icon] ?? Code;
            const active = isSubjectActive(subject.id);
            return (
              <button
                key={subject.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleSubject(subject.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active ? "border-primary" : "border-border hover:bg-accent"
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="min-w-0 flex-1 truncate text-base font-semibold">{subject.title}</span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  )}
                >
                  {active && <Check className="h-4 w-4" />}
                </span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
