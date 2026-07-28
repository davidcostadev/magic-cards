import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

const TABLE_ANSWER = [
  'Four scopes, loaded broadest to most specific:',
  '',
  '| Scope | Location |',
  '|---|---|',
  '| **User** | `~/.claude/CLAUDE.md` |',
  '| **Project** | `./CLAUDE.md` |',
].join('\n');

describe('MarkdownContent', () => {
  it('renders a GFM table as a real table, not raw pipes', () => {
    const { container } = render(<MarkdownContent text={TABLE_ANSWER} />);

    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('thead th')).toHaveLength(2);
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: 'Scope' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Project' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('|---|');
  });

  it('wraps a table so it can scroll sideways on narrow screens', () => {
    const { container } = render(<MarkdownContent text={TABLE_ANSWER} />);

    const wrapper = container.querySelector('table')?.parentElement;
    expect(wrapper?.className).toContain('overflow-x-auto');
  });

  it('keeps a leading table in the body instead of promoting it to the title', () => {
    const leadingTable = [
      '| Primitive | What it is |',
      '|---|---|',
      '| **Tools** | Functions the model invokes |',
      '',
      'Each has discovery methods.',
    ].join('\n');

    const { container } = render(<MarkdownContent text={leadingTable} />);

    // The title renderer has no table wrapper, so this only passes if the table stays in the body.
    expect(container.querySelector('table')?.closest('.md-table-scroll')).not.toBeNull();
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.querySelectorAll('table thead th')).toHaveLength(2);
    expect(screen.getByText('Each has discovery methods.')).toBeInTheDocument();
  });

  it('renders other GFM syntax (strikethrough)', () => {
    const { container } = render(<MarkdownContent text={'Title\n\nUse ~~var~~ instead.'} />);

    expect(container.querySelector('del')?.textContent).toBe('var');
  });
});
