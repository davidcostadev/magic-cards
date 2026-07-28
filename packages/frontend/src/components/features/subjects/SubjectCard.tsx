import { Link } from '@tanstack/react-router';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Subject, SubjectProgress } from '@/api/queries/subjects';
import { getSubjectIcon } from '@/components/features/subjects/subjectIcons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface SubjectCardProps {
  subject: Subject;
  cardCount: number;
  /** Study progress for this subject (reviewed / total / due); absent while loading. */
  progress?: SubjectProgress;
  onEdit: (subject: Subject) => void;
  onDelete: (id: string) => void;
}

const DEFAULT_COLOR = '#6366f1';

export function SubjectCard({ subject, cardCount, progress, onEdit, onDelete }: SubjectCardProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = getSubjectIcon(subject.icon ?? 'code');
  const color = subject.color ?? DEFAULT_COLOR;
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
    <Card className="group relative transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-accent/40 hover:shadow-lg active:translate-y-0 active:scale-[0.99] active:shadow-md">
      {subject.isPublic && (
        <Badge variant="secondary" className="absolute right-3 top-3 z-10">
          {t('subjects.shared')}
        </Badge>
      )}
      {!subject.isPublic && (
        <div className="absolute right-3 top-3">
          <div className="relative">
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon"
              aria-label={t('common.options')}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="h-10 w-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden="true"
                  onClick={() => closeMenu()}
                />
                <div
                  role="menu"
                  aria-label={t('common.options')}
                  className="absolute right-0 z-20 mt-1 w-44 rounded-xl border bg-popover p-1.5 shadow-md"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') closeMenu(true);
                  }}
                >
                  <button
                    type="button"
                    ref={firstItemRef}
                    role="menuitem"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-base transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => {
                      onEdit(subject);
                      closeMenu();
                    }}
                  >
                    <Pencil className="h-5 w-5" />
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-base text-destructive transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                    onClick={() => {
                      onDelete(subject.id);
                      closeMenu();
                    }}
                  >
                    <Trash2 className="h-5 w-5" />
                    {t('common.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <Link
        to="/subjects/$subjectId"
        params={{ subjectId: subject.id }}
        className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <CardHeader className="p-5 pb-2.5">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold truncate">{subject.title}</h3>
              <Badge variant="secondary" className="mt-1">
                {t('subjects.cardCount', { count: cardCount })}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-0">
          <p className="text-sm text-muted-foreground line-clamp-2">{subject.description ?? ''}</p>
        </CardContent>
        {progress && progress.total > 0 && (
          <div className="px-5 pb-5">
            <Progress
              value={progress.reviewed}
              max={progress.total}
              className="h-2"
              aria-label={t('subjects.progressReviewed', {
                reviewed: progress.reviewed,
                total: progress.total,
              })}
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t('subjects.progressReviewed', {
                  reviewed: progress.reviewed,
                  total: progress.total,
                })}
              </span>
              {progress.due > 0 ? (
                <span className="font-medium text-primary">
                  {t('subjects.progressDue', { count: progress.due })}
                </span>
              ) : (
                progress.reviewed >= progress.total && (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {t('subjects.progressDone')}
                  </span>
                )
              )}
            </div>
            {/* How well it's going, not just how far: mastery and answer accuracy so far. */}
            {progress.totalReviews > 0 && (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground tabular-nums">
                  {t('subjects.progressMastered', {
                    mastered: progress.mastered,
                    total: progress.total,
                  })}
                </span>
                <span className="font-medium tabular-nums">
                  {t('subjects.progressAccuracy', { value: progress.accuracy })}
                </span>
              </div>
            )}
          </div>
        )}
      </Link>
    </Card>
  );
}
