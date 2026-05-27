import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubjectCard } from "@/components/features/subjects/SubjectCard";
import { CreateSubjectModal } from "@/components/features/subjects/CreateSubjectModal";
import { mockSubjects as initialSubjects, mockCards } from "@/mocks/data";
import type { Subject } from "@/mocks/types";

export function SubjectsPage() {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const getCardCount = (subjectId: string) =>
    mockCards.filter((c) => c.subjectId === subjectId).length;

  const handleSave = (data: { title: string; description: string; color: string; icon: string }) => {
    if (editingSubject) {
      setSubjects((prev) =>
        prev.map((s) =>
          s.id === editingSubject.id
            ? { ...s, ...data, updatedAt: new Date().toISOString() }
            : s
        )
      );
    } else {
      const newSubject: Subject = {
        id: `sub-${Date.now()}`,
        userId: "user-1",
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSubjects((prev) => [...prev, newSubject]);
    }
    setEditingSubject(null);
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="p-5 md:p-7">
      <div className="mb-7 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("subjects.title")}</h1>
        <Button onClick={() => { setEditingSubject(null); setModalOpen(true); }}>
          <Plus className="mr-2 h-5 w-5" />
          {t("subjects.createSubject")}
        </Button>
      </div>

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t("subjects.noSubjects")}</p>
          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            {t("subjects.createSubject")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              cardCount={getCardCount(subject.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateSubjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        subject={editingSubject}
        onSave={handleSave}
      />
    </div>
  );
}
