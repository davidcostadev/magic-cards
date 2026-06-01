import { useNavigate } from '@tanstack/react-router';
import { Check, Moon, Sparkles, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSubjectIcon } from '@/components/features/subjects/subjectIcons';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/context/PreferencesContext';
import { useTheme } from '@/context/ThemeContext';
import { mockSubjects } from '@/mocks/data';
import { cn } from '@/utils/cn';

interface Option {
  value: string;
  label: string;
  icon?: React.ElementType;
}

export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { updatePreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const { completeOnboarding } = usePreferences();

  const initialLang = i18n.language === 'pt' ? 'pt' : 'en';
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState(initialLang);
  const [cardLanguage, setCardLanguage] = useState(initialLang);
  const [selected, setSelected] = useState<string[]>(() =>
    mockSubjects.slice(0, 4).map((s) => s.id)
  );

  const handleLanguage = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const toggleSubject = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const finish = () => {
    if (selected.length === 0) return;
    updatePreferences({ language, cardLanguage, theme });
    completeOnboarding(selected);
    navigate({ to: '/dashboard' });
  };

  const twoCol = (options: Option[], current: string, onPick: (v: string) => void) => (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant={current === value ? 'default' : 'outline'}
          onClick={() => onPick(value)}
          className="w-full"
          size="lg"
        >
          {Icon && <Icon className="mr-2 h-5 w-5" />}
          {label}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background sm:items-center sm:justify-center sm:p-5">
      <div className="flex min-h-dvh w-full max-w-xl flex-col p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:min-h-0 sm:rounded-2xl sm:border sm:p-8 sm:pb-8 sm:shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{t('onboarding.welcome')}</h1>
          <p className="text-base text-muted-foreground">{t('onboarding.subtitle')}</p>
        </div>

        <div className="my-5 flex justify-center gap-2" aria-hidden="true">
          {[1, 2].map((n) => (
            <span
              key={n}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                step === n ? 'bg-primary' : 'bg-border'
              )}
            />
          ))}
        </div>

        <div className="flex-1 space-y-6">
          {step === 1 ? (
            <>
              <div className="space-y-2.5">
                <Label>{t('onboarding.interfaceLanguage')}</Label>
                {twoCol(
                  [
                    { value: 'en', label: t('settings.english') },
                    { value: 'pt', label: t('settings.portuguese') },
                  ],
                  language,
                  handleLanguage
                )}
              </div>

              <div className="space-y-2.5">
                <Label>{t('onboarding.cardLanguage')}</Label>
                {twoCol(
                  [
                    { value: 'en', label: t('settings.english') },
                    { value: 'pt', label: t('settings.portuguese') },
                  ],
                  cardLanguage,
                  setCardLanguage
                )}
              </div>

              <div className="space-y-2.5">
                <Label>{t('onboarding.theme')}</Label>
                {twoCol(
                  [
                    { value: 'light', label: t('settings.lightMode'), icon: Sun },
                    { value: 'dark', label: t('settings.darkMode'), icon: Moon },
                  ],
                  theme,
                  (v) => setTheme(v as 'light' | 'dark')
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <Label>{t('onboarding.chooseSubjects')}</Label>
              <p className="text-sm text-muted-foreground">{t('onboarding.chooseSubjectsHint')}</p>
              {selected.length === 0 && (
                <p className="text-sm text-destructive">{t('onboarding.selectAtLeastOne')}</p>
              )}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {mockSubjects.map((subject) => {
                  const Icon = getSubjectIcon(subject.icon);
                  const active = selected.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleSubject(subject.id)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        active ? 'border-primary' : 'border-border hover:bg-accent'
                      )}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${subject.color}20`, color: subject.color }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="min-w-0 flex-1 truncate text-base font-semibold">
                        {subject.title}
                      </span>
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                          active
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border'
                        )}
                      >
                        {active && <Check className="h-4 w-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          {step === 2 && (
            <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
              {t('common.back')}
            </Button>
          )}
          {step === 1 ? (
            <Button size="lg" className="flex-1" onClick={() => setStep(2)}>
              {t('onboarding.next')}
            </Button>
          ) : (
            <Button size="lg" className="flex-1" onClick={finish} disabled={selected.length === 0}>
              {t('onboarding.getStarted')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
