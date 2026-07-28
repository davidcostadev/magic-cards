import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoTooltip } from './tooltip';

describe('InfoTooltip', () => {
  it('exposes the hint through the trigger, reachable by keyboard', () => {
    render(<InfoTooltip label="What is the ease factor?">Ease is a multiplier.</InfoTooltip>);

    const trigger = screen.getByRole('button', { name: 'What is the ease factor?' });
    const tooltip = screen.getByRole('tooltip');
    // Described-by, not hidden: the bubble is only faded out, so it still gets announced.
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(tooltip).toHaveTextContent('Ease is a multiplier.');
  });
});
