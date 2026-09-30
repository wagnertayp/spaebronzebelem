import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try { await login(username, password); navigate("/", { replace: true }); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível entrar"); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-subtle-grid flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[430px] rounded-[32px] border border-border bg-surface p-8 shadow-container sm:p-10">
        <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="mx-auto mb-10 h-[64px] w-auto object-contain" />
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm text-text-secondary">Entre para cuidar da operação do seu spa.</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium text-text-primary">Usuário
            <span className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 focus-within:ring-2 focus-within:ring-primary/30">
              <UserRound className="h-5 w-5 text-text-muted" />
              <input required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-transparent outline-none" autoComplete="username" />
            </span>
          </label>
          <label className="block text-sm font-medium text-text-primary">Senha
            <span className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 focus-within:ring-2 focus-within:ring-primary/30">
              <LockKeyhole className="h-5 w-5 text-text-muted" />
              <input required type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent outline-none" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Exibir senha"} className="text-text-muted hover:text-text-primary">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </span>
          </label>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-primary py-3.5 font-semibold text-white shadow-button transition hover:bg-primary-dark disabled:opacity-60">{busy ? "Entrando..." : "Entrar no sistema"}</button>
        </form>
      </section>
    </main>
  );
}