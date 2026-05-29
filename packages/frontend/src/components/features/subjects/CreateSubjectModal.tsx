import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Code, Database, Component, GitBranch } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Subject } from "@/mocks/types";

const COLORS = ["#3178C6", "#E48E00", "#61DAFB", "#F05032", "#68A063", "#DD4B25", "#764ABC", "#FF6F61"];

const ICONS = [
  { id: "code", icon: Code },
  { id: "database", icon: Database },
  { id: "component", icon: Component },
  { id: "git-branch", icon: GitBranch },
];

interface CreateSubjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject?: Subject | null;
  onSave: (data: { title: string; description: string; color: string; icon: string }) => void;
}

export function CreateSubjectModal({ open, onOpenChange, subject, onSave }: CreateSubjectModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState("code");
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    if (subject) {
      setTitle(subject.title);
      setDescription(subject.description);
      setColor(subject.color);
      setIcon(subject.icon);
    } else {
      setTitle("");
      setDescription("");
      setColor(COLORS[0]);
      setIcon("code");
    }
    setTitleError(false);
  }, [subject, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      return;
    }
    onSave({ title, description, color, icon });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subject ? t("subjects.editSubject") : t("subjects.createSubject")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="title">{t("subjects.subjectTitle")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(false); }}
              aria-invalid={titleError}
              aria-describedby={titleError ? "subject-title-error" : undefined}
            />
            {titleError && (
              <p id="subject-title-error" className="text-sm text-destructive">{t("validation.required")}</p>
            )}
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="description">{t("subjects.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2.5">
            <Label>{t("subjects.color")}</Label>
            <div className="flex flex-wrap gap-3">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`${t("subjects.color")} ${c}`}
                  aria-pressed={color === c}
                  className={cn(
                    "h-10 w-10 cursor-pointer rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    color === c ? "scale-110 border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            <Label>{t("subjects.icon")}</Label>
            <div className="flex gap-3">
              {ICONS.map(({ id, icon: IconComponent }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={id}
                  aria-pressed={icon === id}
                  className={cn(
                    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    icon === id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  )}
                  onClick={() => setIcon(id)}
                >
                  <IconComponent className="h-6 w-6" />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
