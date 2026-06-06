import { createContext, type ReactNode, useContext, useState } from 'react';

const ONBOARDED_KEY = 'onboarded';

export function isOnboarded() {
  return localStorage.getItem(ONBOARDED_KEY) === 'true';
}

interface PreferencesContextValue {
  /** Whether the first-login onboarding has been completed. */
  onboarded: boolean;
  /** Mark onboarding as done. The chosen subjects are persisted server-side, not here. */
  completeOnboarding: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [onboarded, setOnboarded] = useState(isOnboarded);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setOnboarded(true);
  };

  return (
    <PreferencesContext.Provider value={{ onboarded, completeOnboarding }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
