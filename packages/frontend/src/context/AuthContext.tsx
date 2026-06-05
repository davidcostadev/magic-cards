import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { apiClient, errorCode, TOKEN_KEY } from '@/api/client';
import type { User } from '@/mocks/types';

const CARD_LANGUAGE_KEY = 'cardLanguage';

type Preferences = Partial<
  Pick<User, 'language' | 'cardLanguage' | 'theme' | 'dailyGoal' | 'nerdStats'>
>;

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  /** True while the session is being restored from a stored token on first load. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => void;
  updatePreferences: (prefs: Preferences) => void;
}

/** The backend `User` (camelCase, no password hash) as typed by the generated client. */
type ApiUser = {
  id: string;
  email: string;
  username: string;
  language: string;
  theme: string;
  dailyGoal: number;
  nerdStats: boolean;
  createdAt: string;
  updatedAt: string;
};

/** `cardLanguage` is a frontend-only preference (which language cards display in). */
function toUser(apiUser: ApiUser): User {
  return { ...apiUser, cardLanguage: localStorage.getItem(CARD_LANGUAGE_KEY) ?? 'all' };
}

/** Thrown by `login`/`signup` carrying the i18n error code from the API envelope. */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasToken = !!localStorage.getItem(TOKEN_KEY);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(hasToken);
  const [loading, setLoading] = useState(hasToken);

  function applySession(token: string, apiUser: ApiUser) {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(toUser(apiUser));
    setIsAuthenticated(true);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setIsAuthenticated(false);
  }

  // Restore the user from a stored token on first load; an invalid/expired token logs out.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await apiClient.GET('/v1/me');
      if (!active) return;
      if (error || !data) clearSession();
      else {
        setUser(toUser(data));
        setIsAuthenticated(true);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await apiClient.POST('/v1/auth/login', { body: { email, password } });
    if (error || !data) throw new AuthError(errorCode(error));
    applySession(data.token, data.user);
  };

  const signup = async (email: string, password: string, username: string) => {
    const { data, error } = await apiClient.POST('/v1/auth/signup', {
      body: { email, password, username },
    });
    if (error || !data) throw new AuthError(errorCode(error));
    applySession(data.token, data.user);
  };

  const logout = () => clearSession();

  const updatePreferences = (prefs: Preferences) => {
    if (prefs.cardLanguage !== undefined)
      localStorage.setItem(CARD_LANGUAGE_KEY, prefs.cardLanguage);
    setUser((prev) => (prev ? { ...prev, ...prefs } : prev));

    const { language, theme, dailyGoal, nerdStats } = prefs;
    if (
      language !== undefined ||
      theme !== undefined ||
      dailyGoal !== undefined ||
      nerdStats !== undefined
    ) {
      void apiClient.PATCH('/v1/me', {
        body: { language, theme: theme as 'light' | 'dark' | undefined, dailyGoal, nerdStats },
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, loading, login, signup, logout, updatePreferences }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
