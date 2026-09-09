import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

type User = { username: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setUser(data?.user ?? null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Não foi possível entrar");
    const data = await response.json();
    setUser(data.user);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);
  if (loading) return <div className="min-h-screen bg-background" aria-label="Carregando sessão" />;
  return user ? <>{children}</> : null;
}