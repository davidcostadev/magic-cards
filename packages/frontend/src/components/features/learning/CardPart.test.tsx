import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CardPart } from './CardPart';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('CardPart', () => {
  it('names the region for screen readers without showing the label', () => {
    render(
      <CardPart part="question">
        <p>What is the TDZ?</p>
      </CardPart>
    );

    const region = screen.getByRole('region', { name: 'learn.part.question' });
    expect(region).toBeInTheDocument();
    // The label is announced, not drawn.
    expect(screen.getByText('learn.part.question')).toHaveClass('sr-only');
  });

  it('tags the region with a readable DOM hook', () => {
    const { container } = render(
      <CardPart part="options">
        <span>A</span>
      </CardPart>
    );

    expect(container.querySelector('[data-card-part="options"]')).not.toBeNull();
  });

  it('gives each region its own heading id so two parts never collide', () => {
    render(
      <>
        <CardPart part="question">
          <p>q</p>
        </CardPart>
        <CardPart part="answer">
          <p>a</p>
        </CardPart>
      </>
    );

    const ids = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(Boolean)).toBe(true);
  });
});
