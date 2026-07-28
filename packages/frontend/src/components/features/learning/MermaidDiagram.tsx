import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

interface MermaidDiagramProps {
  /** The body of a ```mermaid fence, verbatim. */
  chart: string;
}

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, chart: string) => Promise<{ svg: string }>;
};

// Mermaid is a heavy dependency (hundreds of KB), and most cards have no diagram at all. Import it
// on first use so it lands in its own chunk, and keep the promise so a deck full of diagrams pays
// the download once.
let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default as unknown as MermaidApi);
  }
  return mermaidPromise;
}

/**
 * Renders a ```mermaid fence as a diagram, the way VS Code and GitHub do.
 *
 * Mermaid is loaded lazily and re-rendered when the theme flips, so the diagram matches the rest of
 * the card in light and dark. A diagram that fails to parse falls back to its source instead of an
 * empty box — a card author's typo should never hide the content from the learner.
 */
export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Mermaid injects a <g id> per render; a stable unique id keeps two diagrams on one card apart.
  const domId = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          // Mermaid sanitizes the generated SVG at this level; card content is Markdown, not HTML.
          securityLevel: 'strict',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        });
        const result = await mermaid.render(domId, chart);
        if (!cancelled) setSvg(result.svg);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [chart, theme, domId]);

  if (failed) {
    return (
      <div className="md-mermaid md-mermaid-failed" data-mermaid="error">
        <p role="note" className="md-mermaid-note">
          {t('learn.diagramFailed')}
        </p>
        <pre>
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="md-mermaid overflow-x-auto" data-mermaid={svg ? 'ready' : 'loading'}>
      {svg ? (
        // Mermaid output, sanitized by mermaid itself (securityLevel: 'strict').
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the SVG is generated, not user HTML
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <pre className="md-mermaid-pending">
          <code>{chart}</code>
        </pre>
      )}
    </div>
  );
}
