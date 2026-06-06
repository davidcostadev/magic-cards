import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Subject } from '@/api/queries/subjects';
import { ManageSubjectsModal } from './ManageSubjectsModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const select = vi.fn();
const unselect = vi.fn();

vi.mock('@/api/queries/subjects', () => ({
  useSelectSubject: () => ({ mutate: select }),
  useUnselectSubject: () => ({ mutate: unselect }),
}));

const subject = (over: Partial<Subject>): Subject =>
  ({
    id: 'x',
    userId: 'u',
    title: '',
    description: null,
    color: null,
    icon: null,
    isPublic: false,
    cardCount: 0,
    selected: false,
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Subject;

const subjects = [
  subject({ id: 'on', title: 'Selected One', selected: true }),
  subject({ id: 'off', title: 'Unselected One', selected: false }),
];

beforeEach(() => {
  select.mockReset();
  unselect.mockReset();
});

describe('ManageSubjectsModal', () => {
  it('reflects each subject selection state via aria-pressed', () => {
    render(<ManageSubjectsModal open onOpenChange={vi.fn()} subjects={subjects} />);

    expect(screen.getByRole('button', { name: /Selected One/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /Unselected One/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('unselects a selected subject and selects an unselected one', async () => {
    render(<ManageSubjectsModal open onOpenChange={vi.fn()} subjects={subjects} />);

    await userEvent.click(screen.getByRole('button', { name: /Selected One/ }));
    expect(unselect).toHaveBeenCalledWith('on');
    expect(select).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Unselected One/ }));
    expect(select).toHaveBeenCalledWith('off');
  });
});
