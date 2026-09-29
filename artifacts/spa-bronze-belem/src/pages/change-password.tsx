import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export function ChangePassword() {
  const { user, changePassword, logout } = useAuth();
  const [, navigate] = useLocation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate(
        user?.canAccessAgenda ? "/agenda" : user?.canAccessCommissions ? "/usuarios" : "/sem-acesso",
        { replace: true },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-subtle-grid flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-[460px] rounded-[28px] border border-border bg-surface p-8 shadow-container sm:p-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Segurança da conta
        </p>
        <h1 className="text-2xl font-bold text-text-primary">Crie sua senha pessoal</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          A senha temporária não pode ser usada novamente depois desta etapa. Escolha uma senha com pelo menos 12 caracteres.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-text-primary">
            Senha temporária ou atual
            <Input
              className="mt-2"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-text-primary">
            Nova senha
            <Input
              className="mt-2"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-text-primary">
            Confirme a nova senha
            <Input
              className="mt-2"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          <Button disabled={busy} className="w-full">
            {busy ? "Salvando..." : "Salvar senha"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-5 w-full text-center text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          Sair desta conta
        </button>
      </section>
    </main>
  );
}