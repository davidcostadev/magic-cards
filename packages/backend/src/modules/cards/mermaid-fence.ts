/**
 * A cheap structural check on ```mermaid fences in card Markdown.
 *
 * Mermaid's real parser needs a DOM, so it can't run here. What this catches is the mistake that
 * actually happens when authoring: an empty fence, or a diagram whose **type keyword** is missing
 * or misspelled (`graphh TD`) — which mermaid rejects wholesale, leaving the learner with a
 * fallback block instead of a diagram. Everything past the first line (arrows, labels, syntax) is
 * NOT checked; only the frontend renderer can tell you that.
 */

// Mermaid 11 diagram types. `-beta`/`-v2` suffixes are part of the keyword mermaid accepts.
const DIAGRAM_TYPES = [
  'architecture-beta',
  'block-beta',
  'C4Component',
  'C4Container',
  'C4Context',
  'C4Deployment',
  'C4Dynamic',
  'classDiagram',
  'classDiagram-v2',
  'erDiagram',
  'flowchart',
  'flowchart-elk',
  'gantt',
  'gitGraph',
  'graph',
  'journey',
  'kanban',
  'mindmap',
  'packet-beta',
  'pie',
  'quadrantChart',
  'radar-beta',
  'requirementDiagram',
  'sankey-beta',
  'sequenceDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'timeline',
  'treemap',
  'xychart-beta',
  'zenuml',
] as const;

/** ```mermaid ... ``` — the info string must be exactly `mermaid` (optionally padded). */
const MERMAID_FENCE = /^[ \t]*```[ \t]*mermaid[ \t]*\r?\n([\s\S]*?)^[ \t]*```/gm;

/** Strips YAML front matter, `%%{init}%%` directives and `%%` comments ahead of the type keyword. */
function firstMeaningfulLine(body: string): string | null {
  const lines = body.split('\n');
  let i = 0;

  if (lines[i]?.trim() === '---') {
    i++;
    while (i < lines.length && lines[i].trim() !== '---') i++;
    i++; // past the closing ---
  }

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('%%')) continue;
    return line;
  }
  return null;
}

function hasKnownType(line: string): boolean {
  return DIAGRAM_TYPES.some(
    (type) => line === type || line.startsWith(`${type} `) || line.startsWith(`${type}\t`)
  );
}

/**
 * Returns an i18n error code for the first broken mermaid fence in `markdown`, or `null` when
 * every fence looks renderable.
 */
export function findMermaidFenceError(markdown: string): string | null {
  if (!markdown.includes('```')) return null;

  MERMAID_FENCE.lastIndex = 0;
  let match = MERMAID_FENCE.exec(markdown);
  while (match !== null) {
    const line = firstMeaningfulLine(match[1] ?? '');
    if (line === null) return 'cards.mermaidEmpty';
    if (!hasKnownType(line)) return 'cards.mermaidUnknownType';
    match = MERMAID_FENCE.exec(markdown);
  }
  return null;
}
