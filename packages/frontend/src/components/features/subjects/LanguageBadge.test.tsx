import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LanguageBadge } from './LanguageBadge';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('LanguageBadge', () => {
  it('shows the short code with the full language name announced', () => {
    render(<LanguageBadge language="pt" />);
    expect(screen.getByText('PT')).toBeInTheDocument();
    expect(screen.getByLabelText('settings.portuguese')).toBeInTheDocument();
  });

  it('falls back to the uppercased code for an unknown language', () => {
    render(<LanguageBadge language="de" />);
    expect(screen.getByText('DE')).toBeInTheDocument();
  });
});
