import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StudySession } from '@/api/queries/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/utils/cn';

type Metric = 'accuracy' | 'reviews' | 'mastered';

interface ProgressTimelineProps {
  sessions: StudySession[];
  /** Optional line above the chart — used to say which subject it covers. */
  subtitle?: string;
  className?: string;
}

const HEIGHT = 200;
const PAD = { top: 14, right: 14, bottom: 24, left: 36 };
const FALLBACK_WIDTH = 640;
const MAX_BAR_WIDTH = 24;
const MAX_X_LABELS = 4;

/**
 * One hue per metric, borrowed from the status colours already used on this page so the
 * green line and the "Mastered" chip mean the same thing. Only one metric is plotted at a
 * time, which is also why there is no legend: the toggle above the chart names the series.
 */
const METRICS: Record<
  Metric,
  { shape: 'line' | 'bar'; stroke: string; fill: string; area: string; max: 'percent' | 'data' }
> = {
  accuracy: {
    shape: 'line',
    stroke: 'stroke-primary',
    fill: 'fill-primary',
    area: 'fill-primary/10',
    max: 'percent',
  },
  reviews: {
    shape: 'bar',
    stroke: 'stroke-blue-500',
    fill: 'fill-blue-500',
    area: 'fill-blue-500/10',
    max: 'data',
  },
  mastered: {
    shape: 'line',
    stroke: 'stroke-success',
    fill: 'fill-success',
    area: 'fill-success/10',
    max: 'data',
  },
};

const METRIC_LABELS: Record<Metric, string> = {
  accuracy: 'dashboard.timelineAccuracy',
  reviews: 'dashboard.timelineReviews',
  mastered: 'dashboard.timelineMastered',
};

/** The next round number at or above `value` — 1, 2, 5 or 10 times a power of ten. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  return (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
}

/**
 * Gridline values for a count axis. The step is sized off a third of the data so three or four
 * lines cover the range and every tick lands on a whole number — a bar peaking at 23 gets an
 * axis to 30, not to 50 with the data squashed into the bottom half.
 */
function countTicks(dataMax: number): number[] {
  const step = niceStep(Math.max(dataMax, 1) / 3);
  const max = Math.max(step, Math.ceil(dataMax / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += step) ticks.push(value);
  return ticks;
}

/** Column with a rounded cap and a square foot on the baseline. */
function barPath(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.min(radius, width / 2, height);
  const bottom = y + height;
  return `M${x},${bottom} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${bottom} Z`;
}

/**
 * Live width of the chart box, so 1 SVG unit stays 1 CSS pixel and the text never distorts.
 *
 * A callback ref, not an effect over a `useRef`: the chart box only mounts once the sessions
 * arrive (before that the card shows the empty state), and an effect that already ran with a
 * null ref would never come back — leaving the chart stuck at its fallback width.
 */
function useElementWidth<T extends HTMLElement>(): [number, (node: T | null) => void] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    setWidth(node.getBoundingClientRect().width);
    observer.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.current.observe(node);
  }, []);

  return [width, measure];
}

export function ProgressTimeline({ sessions, subtitle, className }: ProgressTimelineProps) {
  const { t, i18n } = useTranslation();
  const [metric, setMetric] = useState<Metric>('accuracy');
  const [active, setActive] = useState<number | null>(null);
  const [measured, boxRef] = useElementWidth<HTMLDivElement>();
  const width = measured || FALLBACK_WIDTH;

  // A turn that scrolls out of the data (subject switch, reset) shouldn't keep a stale tooltip.
  useEffect(() => {
    setActive(null);
  }, [sessions]);

  const formatDay = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' });
  const formatDayTime = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (sessions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('dashboard.timelineTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-base text-muted-foreground">
            {t('dashboard.timelineEmpty')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const spec = METRICS[metric];
  const values = sessions.map((session) => session[metric]);
  const ticks = spec.max === 'percent' ? [0, 50, 100] : countTicks(Math.max(...values));
  const max = ticks[ticks.length - 1];
  const innerWidth = Math.max(1, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const band = innerWidth / sessions.length;
  const x = (index: number) => PAD.left + band * (index + 0.5);
  const y = (value: number) => PAD.top + innerHeight * (1 - value / max);
  const baseline = PAD.top + innerHeight;
  // Fewer date labels on a phone, where four of them almost touch.
  const labelStep = Math.max(1, Math.ceil(sessions.length / (width < 420 ? 3 : MAX_X_LABELS)));
  const barWidth = Math.max(2, Math.min(MAX_BAR_WIDTH, band * 0.7));
  const linePoints = sessions.map((_, index) => `${x(index)},${y(values[index])}`).join(' ');
  const areaPath = [
    `M${x(0)},${baseline}`,
    ...sessions.map((_, index) => `L${x(index)},${y(values[index])}`),
    `L${x(sessions.length - 1)},${baseline}`,
    'Z',
  ].join(' ');
  const activeSession = active === null ? null : sessions[active];

  return (
    <Card className={className}>
      <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="text-lg">{t('dashboard.timelineTitle')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle ?? t('dashboard.timelineSubtitle')}
          </p>
        </div>
        <fieldset className="flex w-full gap-1 rounded-xl bg-muted p-1 sm:w-auto">
          <legend className="sr-only">{t('dashboard.timelineMetric')}</legend>
          {(['accuracy', 'reviews', 'mastered'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={metric === option}
              onClick={() => setMetric(option)}
              className={cn(
                'flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                'hover:bg-background/70 active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                metric === option
                  ? 'bg-background text-foreground shadow-sm hover:bg-background'
                  : 'text-muted-foreground'
              )}
            >
              {t(METRIC_LABELS[option])}
            </button>
          ))}
        </fieldset>
      </CardHeader>
      <CardContent>
        <div ref={boxRef} className="relative">
          <svg
            width="100%"
            height={HEIGHT}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            className="overflow-visible"
          >
            <title>{t('dashboard.timelineTitle')}</title>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick) + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {metric === 'accuracy' ? `${tick}%` : tick}
                </text>
              </g>
            ))}

            {spec.shape === 'bar'
              ? sessions.map((session, index) => {
                  const top = y(values[index]);
                  return (
                    <path
                      key={session.startedAt}
                      d={barPath(x(index) - barWidth / 2, top, barWidth, baseline - top)}
                      className={cn(spec.fill, active === index ? 'opacity-100' : 'opacity-85')}
                    />
                  );
                })
              : null}

            {spec.shape === 'line' ? (
              <>
                <path d={areaPath} className={spec.area} />
                <polyline
                  points={linePoints}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={spec.stroke}
                />
                <circle
                  cx={x(sessions.length - 1)}
                  cy={y(values[sessions.length - 1])}
                  r={4}
                  strokeWidth={2}
                  className={cn(spec.fill, 'stroke-card')}
                />
              </>
            ) : null}

            {active !== null ? (
              <>
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD.top}
                  y2={baseline}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <circle
                  cx={x(active)}
                  cy={y(values[active])}
                  r={5}
                  strokeWidth={2}
                  className={cn(spec.fill, 'stroke-card')}
                />
              </>
            ) : null}

            {sessions.map((session, index) =>
              index % labelStep === 0 ? (
                <text
                  key={`label-${session.startedAt}`}
                  x={x(index)}
                  y={HEIGHT - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatDay(session.startedAt)}
                </text>
              ) : null
            )}
          </svg>

          {/* Hit targets sit above the plot as real buttons — a whole band wide, so a thin bar
              or an 8px dot is still easy to reach, and a tap works where there is no hover. */}
          <div
            className="absolute flex"
            style={{
              left: PAD.left,
              right: PAD.right,
              top: PAD.top,
              height: innerHeight,
            }}
          >
            {sessions.map((session, index) => (
              <button
                key={`hit-${session.startedAt}`}
                data-testid="timeline-point"
                type="button"
                className={cn(
                  'flex-1 cursor-pointer rounded-md transition-colors',
                  'hover:bg-foreground/5 focus-visible:bg-foreground/5',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                )}
                aria-label={`${formatDayTime(session.startedAt)}: ${t('dashboard.timelineAccuracy')} ${session.accuracy}%, ${t('dashboard.timelineReviews')} ${session.reviews}, ${t('dashboard.timelineMastered')} ${session.mastered}`}
                onClick={() => setActive(index)}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive((current) => (current === index ? null : current))}
                onFocus={() => setActive(index)}
                onBlur={() => setActive((current) => (current === index ? null : current))}
              />
            ))}
          </div>

          {activeSession ? (
            <div
              data-testid="timeline-tooltip"
              className="pointer-events-none absolute top-0 z-10 w-max max-w-[14rem] -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-sm shadow-md"
              // Half the tooltip's own max width, so it never spills out of the card.
              style={{
                left: `${Math.min(Math.max(x(active ?? 0), 112), Math.max(width - 112, 112))}px`,
              }}
            >
              <p className="font-medium">{formatDayTime(activeSession.startedAt)}</p>
              <dl className="mt-1 space-y-0.5 text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <dt>{t('dashboard.timelineAccuracy')}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {activeSession.accuracy}%
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{t('dashboard.timelineReviews')}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {activeSession.reviews}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{t('dashboard.timelineMastered')}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {activeSession.mastered}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>

        {/* The chart's data, reachable without seeing it. */}
        <table className="sr-only">
          <caption>{t('dashboard.timelineTitle')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('dashboard.timelineTurn')}</th>
              <th scope="col">{t('dashboard.timelineAccuracy')}</th>
              <th scope="col">{t('dashboard.timelineReviews')}</th>
              <th scope="col">{t('dashboard.timelineMastered')}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={`row-${session.startedAt}`}>
                <th scope="row">{formatDayTime(session.startedAt)}</th>
                <td>{session.accuracy}%</td>
                <td>{session.reviews}</td>
                <td>{session.mastered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
