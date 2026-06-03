import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

/** Short code + full-name i18n key for each supported content language. */
const LANGUAGE_META: Record<string, { short: string; nameKey: string }> = {
  en: { short: 'EN', nameKey: 'settings.english' },
  pt: { short: 'PT', nameKey: 'settings.portuguese' },
};

interface LanguageBadgeProps {
  language: string;
  className?: string;
}

/** Compact badge showing a subject's content language (e.g. "EN"), with the full name announced. */
export function LanguageBadge({ language, className }: LanguageBadgeProps) {
  const { t } = useTranslation();
  const meta = LANGUAGE_META[language];
  const name = meta ? t(meta.nameKey) : language;
  const short = meta ? meta.short : language.toUpperCase();

  return (
    <Badge variant="outline" className={className} aria-label={name} title={name}>
      {short}
    </Badge>
  );
}
