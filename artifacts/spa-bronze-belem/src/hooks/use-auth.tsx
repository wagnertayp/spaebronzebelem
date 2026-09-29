import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetAuthSessionQueryKey,
  useChangeStaffPassword,
  useGetAuthSession,
  useLogin,
  useLogout,
  type AuthUser,
} from "@workspace/api-client-react";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
    if (error instanceof Error && error.message) return error.message;
  }
  return fallback;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const sessionQuery = useGetAuthSession({
    query: {
      queryKey: getGetAuthSessionQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const changePasswordMutation = useChangeStaffPassword();

  useEffect(() => {
    if (sessionQuery.isFetched) setUser(sessionQuery.data?.user ?? null);
  }, [sessionQuery.data, sessionQuery.isFetched]);

  const login = async (username: string, password: string) => {
    try {
      await queryClient.cancelQueries();
      const response = await loginMutation.mutateAsync({ data: { username, password } });
      queryClient.clear();
      setUser(response.user);
      queryClient.setQueryData(getGetAuthSessionQueryKey(), { user: response.user });
    } catch (error) {
      throw new Error(errorMessage(error, "Não foi possível entrar"));
    }
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    queryClient.clear();
    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await changePasswordMutation.mutateAsync({
        data: { currentPassword, newPassword },
      });
      setUser(response.user);
      queryClient.setQueryData(getGetAuthSessionQueryKey(), { user: response.user });
    } catch (error) {
      throw new Error(errorMessage(error, "Não foi possível alterar a senha"));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading: sessionQuery.isLoading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    else if (!loading && user?.mustChangePassword && location !== "/change-password") {
      navigate("/change-password", { replace: true });
    } else if (!loading && user?.role === "admin" && location === "/change-password") {
      navigate("/", { replace: true });
    }
  }, [loading, user, location, navigate]);
  if (loading) return <div className="min-h-screen bg-background" aria-label="Carregando sessão" />;
  if (user?.mustChangePassword && location !== "/change-password") return null;
  return user ? <>{children}</> : null;
}