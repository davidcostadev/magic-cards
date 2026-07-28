import { ArrowUpDown } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { cn } from '@/utils/cn';

interface SortSelectProps<T extends string> {
  value: T;
  /** The available orderings, in display order; labels come from `optionLabel`. */
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * The "Sort by" control shared by the subjects grid and the card list. The label is visible on
 * wider screens and collapses to an icon + accessible name on mobile, where the row is tight.
 */
export function SortSelect<T extends string>({
  value,
  options,
  optionLabel,
  onChange,
  className,
}: SortSelectProps<T>) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label
        htmlFor={id}
        className="hidden shrink-0 items-center gap-1.5 text-sm text-muted-foreground sm:flex"
      >
        <ArrowUpDown className="h-4 w-4" />
        {t('common.sortBy')}
      </label>
      <Select
        id={id}
        aria-label={t('common.sortBy')}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </Select>
    </div>
  );
}
