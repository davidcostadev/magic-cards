import { createContext, type ReactNode, useContext, useState } from 'react';

const ONBOARDED_KEY = 'onboarded';
const SUBJECTS_KEY = 'selectedSubjects';

export function isOnboarded() {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

function readSelectedSubjects(): string[] | null {
  try {
    const raw = localStorage.getItem(SUBJECTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

interface PreferencesContextValue {
  /** Whether the first-login onboarding has been completed. */
  onboarded: boolean;
  /** Persist the chosen subjects and mark onboarding as done. */
  completeOnboarding: (subjectIds: string[]) => void;
  /** Active subject ids. `null` means "all subjects" (no selection saved yet). */
  selectedSubjectIds: string[] | null;
  /** Replace the whole active selection. */
  setSelectedSubjectIds: (ids: string[]) => void;
  /** Add/remove a single subject from the active selection. */
  toggleSubject: (id: string) => void;
  /** Whether a subject is part of the active selection. */
  isSubjectActive: (id: string) => boolean;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [onboarded, setOnboarded] = useState(isOnboarded);
  const [selectedSubjectIds, setSelected] = useState<string[] | null>(readSelectedSubjects);

  const persist = (ids: string[]) => {
    localStorage.setItem(SUBJECTS_KEY, JSON.stringify(ids));
    setSelected(ids);
  };

  const completeOnboarding = (subjectIds: string[]) => {
    persist(subjectIds);
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOnboarded(true);
  };

  const toggleSubject = (id: string) => {
    setSelected((prev) => {
      const base = prev ?? [];
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      localStorage.setItem(SUBJECTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isSubjectActive = (id: string) =>
    selectedSubjectIds === null || selectedSubjectIds.includes(id);

  return (
    <PreferencesContext.Provider
      value={{
        onboarded,
        completeOnboarding,
        selectedSubjectIds,
        setSelectedSubjectIds: persist,
        toggleSubject,
        isSubjectActive,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
