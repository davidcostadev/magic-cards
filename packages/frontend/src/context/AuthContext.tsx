import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "@/mocks/types";
import { mockUser } from "@/mocks/data";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => void;
  signup: (email: string, password: string, username: string) => void;
  logout: () => void;
  updatePreferences: (prefs: Partial<Pick<User, "language" | "cardLanguage" | "theme" | "dailyGoal">>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (!localStorage.getItem("auth_token")) return null;
    return { ...mockUser, cardLanguage: localStorage.getItem("cardLanguage") ?? mockUser.cardLanguage };
  });

  const login = (_email: string, _password: string) => {
    localStorage.setItem("auth_token", "mock-jwt-token");
    setUser({ ...mockUser, cardLanguage: localStorage.getItem("cardLanguage") ?? mockUser.cardLanguage });
  };

  const signup = (_email: string, _password: string, username: string) => {
    localStorage.setItem("auth_token", "mock-jwt-token");
    setUser({ ...mockUser, username });
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  const updatePreferences = (prefs: Partial<Pick<User, "language" | "cardLanguage" | "theme" | "dailyGoal">>) => {
    if (prefs.cardLanguage !== undefined) localStorage.setItem("cardLanguage", prefs.cardLanguage);
    setUser((prev) => (prev ? { ...prev, ...prefs } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        signup,
        logout,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
