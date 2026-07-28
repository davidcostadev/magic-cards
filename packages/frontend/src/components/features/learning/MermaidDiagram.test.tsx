import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MermaidDiagram } from './MermaidDiagram';

const initialize = vi.fn();
const renderChart = vi.fn();

vi.mock('mermaid', () => ({
  default: {
    get initialize() {
      return initialize;
    },
    get render() {
      return renderChart;
    },
  },
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

const CHART = 'graph TD;\n  A-->B;';

beforeEach(() => {
  initialize.mockReset();
  renderChart.mockReset();
  renderChart.mockResolvedValue({ svg: '<svg data-testid="diagram"><g /></svg>' });
});

describe('MermaidDiagram', () => {
  it('renders the SVG mermaid produces', async () => {
    const { container } = render(<MermaidDiagram chart={CHART} />);

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    expect(renderChart).toHaveBeenCalledWith(expect.any(String), CHART);
  });

  it('follows the active theme', async () => {
    render(<MermaidDiagram chart={CHART} />);

    await waitFor(() => expect(initialize).toHaveBeenCalled());
    expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('falls back to the source when the diagram is invalid', async () => {
    renderChart.mockRejectedValue(new Error('Parse error on line 1'));

    render(<MermaidDiagram chart={CHART} />);

    // The learner still sees the source instead of an empty box.
    await waitFor(() => expect(screen.getByText(/graph TD/)).toBeInTheDocument());
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});
