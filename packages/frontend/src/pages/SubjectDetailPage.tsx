import { Link, useParams } from '@tanstack/react-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Flag,
  GraduationCap,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Card,
  useCards,
  useCreateCard,
  useDeleteCard,
  useUpdateCard,
} from '@/api/queries/cards';
import { useCardReports } from '@/api/queries/reports';
import { useSubject, useSubjectCardStats, useSubjectStats } from '@/api/queries/subjects';
import { SortSelect } from '@/components/common/SortSelect';
import { CardForm, type CardFormData } from '@/components/features/cards/CardForm';
import { CardList } from '@/components/features/cards/CardList';
import { CardView } from '@/components/features/cards/CardView';
import { filterCards } from '@/components/features/cards/filterCards';
import { CARD_SORTS, type CardSort, sortCards } from '@/components/features/cards/sortCards';
import { getSubjectIcon } from '@/components/features/subjects/subjectIcons';
import { Button, buttonVariants } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle, Card as UiCard } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 20;
/** Stable empty map so sorting doesn't re-run while the per-card stats are still loading. */
const EMPTY_STATS = new Map<string, never>();

export function SubjectDetailPage() {
  const { subjectId } = useParams({ from: '/subjects/$subjectId' });
  const { t } = useTranslation();
  const { data: subject, isLoading: subjectLoading, isError } = useSubject(subjectId);
  const { data: cards = [] } = useCards(subjectId);
  const { data: reports = [] } = useCardReports(subjectId);
  const { data: stats } = useSubjectStats(subjectId);
  const { data: cardStats } = useSubjectCardStats(subjectId);
  const createCard = useCreateCard();
  const updateCard = useUpdateCard();
  const deleteCard = useDeleteCard();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingCard, setViewingCard] = useState<Card | null>(null);
  const [query, setQuery] = useState('');
  const [showReportedOnly, setShowReportedOnly] = useState(false);
  const [sort, setSort] = useState<CardSort>('recent');
  const [page, setPage] = useState(0);

  // The cards the current user has reported in this subject — drives the badge and the filter.
  const reportedIds = useMemo(() => new Set(reports.map((r) => r.cardId)), [reports]);
  // Reports the catalog side has since marked resolved — shown with a "resolved" badge.
  const resolvedIds = useMemo(
    () => new Set(reports.filter((r) => r.resolved).map((r) => r.cardId)),
    [reports]
  );
  const filteredCards = useMemo(() => {
    const bySearch = filterCards(cards, query);
    const visible = showReportedOnly ? bySearch.filter((c) => reportedIds.has(c.id)) : bySearch;
    // Sorting runs over the whole filtered deck, so paging walks the sorted order.
    return sortCards(visible, cardStats ?? EMPTY_STATS, sort);
  }, [cards, query, showReportedOnly, reportedIds, cardStats, sort]);
  // A new search, filter, or ordering resets to the first page.
  useEffect(() => {
    setPage(0);
  }, [query, showReportedOnly, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageCards = filteredCards.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (subjectLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-7 space-y-5">
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
        <p className="text-lg text-muted-foreground">{t('errors.notFound')}</p>
        <Link to="/subjects" className="mt-3 inline-block text-primary hover:underline">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const Icon = getSubjectIcon(subject.icon ?? 'code');
  const color = subject.color ?? '#6366f1';
  const isPublic = subject.isPublic;

  const handleSave = (data: CardFormData) => {
    if (editingCard) {
      // `type` and `subjectId` are immutable, so only the editable fields go in the PATCH.
      const { type: _type, ...body } = data;
      updateCard.mutate({ id: editingCard.id, body });
    } else {
      createCard.mutate({ subjectId, ...data });
    }
    setEditingCard(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-7">
      <div className="mb-7">
        <Link
          to="/subjects"
          className="inline-flex items-center gap-1.5 text-base text-muted-foreground hover:text-foreground mb-5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-5 w-5" />
          {t('common.back')}
        </Link>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate sm:text-3xl">{subject.title}</h1>
              <p className="text-sm text-muted-foreground line-clamp-2 sm:text-base">
                {isPublic ? t('subjects.sharedReadOnly') : (subject.description ?? '')}
              </p>
            </div>
          </div>
          {cards.length > 0 && (
            <Link
              to="/learn/$subjectId"
              params={{ subjectId }}
              className={cn(buttonVariants(), 'hidden shrink-0 sm:inline-flex')}
            >
              <GraduationCap className="mr-2 h-5 w-5" />
              {t('cards.startStudying')}
            </Link>
          )}
        </div>
        {!isPublic && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => {
                setEditingCard(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-5 w-5" />
              {t('cards.createCard')}
            </Button>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <UiCard className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('subjects.statsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-x-10 gap-y-3">
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.totalCards ?? cards.length}
                </p>
                <p className="text-sm text-muted-foreground">{t('subjects.statTotal')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums text-primary">{stats?.due ?? 0}</p>
                <p className="text-sm text-muted-foreground">{t('subjects.statDue')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{stats?.accuracy ?? 0}%</p>
                <p className="text-sm text-muted-foreground">{t('subjects.statAccuracy')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{stats?.totalReviews ?? 0}</p>
                <p className="text-sm text-muted-foreground">{t('subjects.statReviews')}</p>
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.avgEaseFactor != null ? stats.avgEaseFactor.toFixed(2) : '—'}
                </p>
                <p className="text-sm text-muted-foreground">{t('subjects.statEase')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5 border-t pt-5 sm:grid-cols-4">
              {(
                [
                  { key: 'new', label: t('dashboard.new'), color: 'bg-blue-500' },
                  { key: 'learning', label: t('dashboard.learning'), color: 'bg-warning' },
                  { key: 'reviewing', label: t('dashboard.reviewing'), color: 'bg-primary' },
                  { key: 'mastered', label: t('dashboard.mastered'), color: 'bg-success' },
                ] as const
              ).map(({ key, label, color }) => (
                <div key={key} className="text-center">
                  <div className={`mx-auto mb-2.5 h-3 w-16 rounded-full ${color}`} />
                  <p className="text-3xl font-bold tabular-nums">{stats?.[key] ?? 0}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </UiCard>
      )}

      {cards.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[12rem] max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('cards.search')}
              aria-label={t('cards.search')}
              className="pl-11"
            />
          </div>
          {reportedIds.size > 0 && (
            <Button
              variant={showReportedOnly ? 'default' : 'outline'}
              aria-pressed={showReportedOnly}
              onClick={() => setShowReportedOnly((v) => !v)}
            >
              <Flag className="mr-2 h-5 w-5" />
              {t('reports.filterReported')} ({reportedIds.size})
            </Button>
          )}
          <SortSelect
            className="w-full sm:w-auto"
            value={sort}
            options={CARD_SORTS}
            optionLabel={(option) => t(`cards.sort.${option}`)}
            onChange={setSort}
          />
        </div>
      )}

      {cards.length > 0 && filteredCards.length === 0 ? (
        <p className="py-16 text-center text-lg text-muted-foreground">{t('cards.noResults')}</p>
      ) : (
        <>
          <CardList
            cards={pageCards}
            reportedIds={reportedIds}
            resolvedIds={resolvedIds}
            stats={cardStats}
            readOnly={isPublic}
            onView={(card) => {
              setViewingCard(card);
              setViewOpen(true);
            }}
            onEdit={(card) => {
              setEditingCard(card);
              setFormOpen(true);
            }}
            onDelete={(id) => deleteCard.mutate({ id, subjectId })}
          />

          {pageCount > 1 && (
            <nav
              className="mt-5 flex items-center justify-center gap-4"
              aria-label={t('cards.pagination')}
            >
              <Button
                variant="outline"
                size="icon"
                aria-label={t('common.previous')}
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('common.next')}
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </nav>
          )}
        </>
      )}

      <CardView
        open={viewOpen}
        onOpenChange={setViewOpen}
        card={viewingCard}
        canEdit={!isPublic}
        onEdit={() => {
          if (viewingCard) {
            setEditingCard(viewingCard);
            setFormOpen(true);
          }
        }}
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
            buttonVariants({ size: 'sm' }),
            'fixed bottom-20 right-5 z-40 shadow-lg sm:hidden'
          )}
        >
          <GraduationCap className="mr-2 h-5 w-5" />
          {t('cards.startStudying')}
        </Link>
      )}
    </div>
  );
}
