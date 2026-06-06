import { BookOpen, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Subject,
  useCreateSubject,
  useDeleteSubject,
  useSubjects,
  useSubjectsProgress,
  useUpdateSubject,
} from '@/api/queries/subjects';
import { CreateSubjectModal } from '@/components/features/subjects/CreateSubjectModal';
import { filterSubjects } from '@/components/features/subjects/filterSubjects';
import { ManageSubjectsModal } from '@/components/features/subjects/ManageSubjectsModal';
import { SubjectCard } from '@/components/features/subjects/SubjectCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function SubjectsPage() {
  const { t } = useTranslation();
  const { data: subjects = [], isLoading, isError } = useSubjects();
  const { data: progressList } = useSubjectsProgress();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  const [modalOpen, setModalOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [query, setQuery] = useState('');

  // The grid shows only the subjects the user has added to their list ("Manage" toggles this).
  const activeSubjects = useMemo(() => subjects.filter((s) => s.selected), [subjects]);
  const filteredSubjects = useMemo(
    () => filterSubjects(activeSubjects, query),
    [activeSubjects, query]
  );

  const progressById = useMemo(
    () => new Map((progressList ?? []).map((p) => [p.subjectId, p])),
    [progressList]
  );

  const handleSave = (data: {
    title: string;
    description: string;
    color: string;
    icon: string;
  }) => {
    if (editingSubject) {
      updateSubject.mutate({ id: editingSubject.id, body: data });
    } else {
      createSubject.mutate(data);
    }
    setEditingSubject(null);
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteSubject.mutate(id);
  };

  return (
    <div className="p-5 md:p-7">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t('subjects.title')}</h1>
        <div className="flex gap-2">
          {subjects.length > 0 && (
            <Button variant="outline" onClick={() => setManageOpen(true)}>
              <SlidersHorizontal className="mr-2 h-5 w-5" />
              {t('subjects.manage')}
            </Button>
          )}
          <Button
            onClick={() => {
              setEditingSubject(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 h-5 w-5" />
            {t('subjects.createSubject')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-20 text-center text-lg text-destructive">{t('errors.internal')}</p>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t('subjects.noSubjects')}</p>
          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            {t('subjects.createSubject')}
          </Button>
        </div>
      ) : activeSubjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground" />
          <p className="text-lg text-muted-foreground">{t('subjects.noActive')}</p>
          <Button size="lg" variant="outline" onClick={() => setManageOpen(true)}>
            <SlidersHorizontal className="mr-2 h-5 w-5" />
            {t('subjects.manage')}
          </Button>
        </div>
      ) : (
        <>
          <div className="relative mb-5 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('subjects.search')}
              className="pl-11"
            />
          </div>
          {filteredSubjects.length === 0 ? (
            <p className="py-16 text-center text-lg text-muted-foreground">
              {t('subjects.noResults')}
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSubjects.map((subject) => (
                <SubjectCard
                  key={subject.id}
                  subject={subject}
                  cardCount={subject.cardCount}
                  progress={progressById.get(subject.id)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CreateSubjectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        subject={editingSubject}
        onSave={handleSave}
      />

      <ManageSubjectsModal open={manageOpen} onOpenChange={setManageOpen} subjects={subjects} />
    </div>
  );
}
