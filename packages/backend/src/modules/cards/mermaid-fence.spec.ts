import { describe, expect, it } from 'vitest';
import { findMermaidFenceError } from './mermaid-fence';

const fence = (body: string) => `Intro\n\n\`\`\`mermaid\n${body}\n\`\`\``;

describe('findMermaidFenceError', () => {
  it('passes content with no mermaid fence at all', () => {
    expect(findMermaidFenceError('Just **text** and `code`.')).toBeNull();
    expect(findMermaidFenceError('```js\nconst a = 1;\n```')).toBeNull();
  });

  it.each([
    'graph TD\n  A-->B',
    'flowchart LR\n  A-->B',
    'sequenceDiagram\n  A->>B: hi',
    'stateDiagram-v2\n  [*] --> Still',
    'erDiagram\n  A ||--o{ B : has',
    'mindmap\n  root((x))',
    'C4Context\n  title X',
    'xychart-beta\n  line [1, 2]',
  ])('accepts a %s diagram', (body) => {
    expect(findMermaidFenceError(fence(body))).toBeNull();
  });

  it('accepts a front-matter block and an init directive before the type', () => {
    expect(findMermaidFenceError(fence('---\ntitle: X\n---\ngraph TD\n  A-->B'))).toBeNull();
    expect(
      findMermaidFenceError(fence('%%{init: {"theme":"dark"}}%%\ngraph TD\n  A-->B'))
    ).toBeNull();
    expect(findMermaidFenceError(fence('%% a comment\ngraph TD\n  A-->B'))).toBeNull();
  });

  it('rejects an empty fence', () => {
    expect(findMermaidFenceError('```mermaid\n\n```')).toBe('cards.mermaidEmpty');
  });

  it('rejects an unknown diagram type', () => {
    expect(findMermaidFenceError(fence('graphh TD\n  A-->B'))).toBe('cards.mermaidUnknownType');
    expect(findMermaidFenceError(fence('A-->B'))).toBe('cards.mermaidUnknownType');
  });

  it('checks every fence, not just the first', () => {
    const two = `${fence('graph TD\n  A-->B')}\n\n${fence('nonsense\n  A-->B')}`;
    expect(findMermaidFenceError(two)).toBe('cards.mermaidUnknownType');
  });

  it('ignores a mermaid word that is not a fence info string', () => {
    expect(findMermaidFenceError('We use mermaid for diagrams.')).toBeNull();
    expect(findMermaidFenceError('```\nmermaid\n```')).toBeNull();
  });
});
