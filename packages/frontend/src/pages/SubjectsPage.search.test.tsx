import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubjectsPage } from './SubjectsPage';

const searchMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => searchMock(),
  useNavigate: () => navigateMock,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const subject = (id: string, title: string) => ({
  id,
  userId: 'u1',
  title,
  description: null,
  color: null,
  icon: null,
  isPublic: false,
  cardCount: 4,
  selected: true,
  createdAt: '',
  updatedAt: '',
});

vi.mock('@/api/queries/subjects', () => ({
  useSubjects: () => ({
    data: [subject('a', 'Rust'), subject('b', 'Kafka')],
    isLoading: false,
  }),
  useSubjectsProgress: () => ({ data: [] }),
  useCreateSubject: () => ({ mutate: vi.fn() }),
  useUpdateSubject: () => ({ mutate: vi.fn() }),
  useDeleteSubject: () => ({ mutate: vi.fn() }),
  useSelectSubject: () => ({ mutate: vi.fn() }),
  useUnselectSubject: () => ({ mutate: vi.fn() }),
}));

beforeEach(() => {
  searchMock.mockReset();
  navigateMock.mockReset();
});

/** Runs the `search` updater the page hands to `navigate`, against a starting search object. */
function appliedSearch(current: Record<string, unknown> = {}) {
  const updater = navigateMock.mock.calls.at(-1)?.[0]?.search;
  return typeof updater === 'function' ? updater(current) : updater;
}

describe('SubjectsPage URL search', () => {
  it('filters from ?q= on first render, with no navigation of its own', () => {
    searchMock.mockReturnValue({ q: 'kaf' });

    render(<SubjectsPage />);

    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.queryByText('Rust')).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('writes the typed query to the URL without stacking history entries', async () => {
    searchMock.mockReturnValue({});

    render(<SubjectsPage />);
    await userEvent.type(screen.getByPlaceholderText('subjects.search'), 'ru');

    expect(navigateMock).toHaveBeenCalled();
    expect(appliedSearch()).toEqual({ q: 'u' }); // last keystroke, applied to an empty search
    expect(navigateMock.mock.calls.at(-1)?.[0]?.replace).toBe(true);
  });

  it('drops ?q= entirely when the search box is cleared', async () => {
    searchMock.mockReturnValue({ q: 'rust' });

    render(<SubjectsPage />);
    await userEvent.clear(screen.getByPlaceholderText('subjects.search'));

    expect(appliedSearch({ q: 'rust' })).toEqual({ q: undefined });
  });

  it('keeps the query in the URL when only the sort changes', async () => {
    searchMock.mockReturnValue({ q: 'rust' });

    render(<SubjectsPage />);
    await userEvent.selectOptions(screen.getByLabelText('common.sortBy'), 'leastMastered');

    expect(appliedSearch({ q: 'rust' })).toEqual({ q: 'rust', sort: 'leastMastered' });
  });
});
