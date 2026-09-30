import { useMemo, useState, type FormEvent } from "react";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import {
  getListStaffAccessAccountsQueryKey,
  useCreateStaffAccessAccount,
  useListProfessionals,
  useListStaffAccessAccounts,
  useResetStaffAccessPassword,
  useUpdateStaffAccessAccount,
  type StaffAccessAccount,
  type StaffAccessAccountUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type TemporaryCredential = { username: string; password: string; kind: "initial" | "reset" };
type AgendaScope = "own" | "team";

const toUsername = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40);

const apiErrorMessage = (error: unknown) => {
  if (error && typeof error === "object") {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      return data.error;
    }
    if (error instanceof Error) return error.message;
  }
  return "Não foi possível concluir a operação.";
};

export function StaffAccessTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: accounts, isLoading: accountsLoading } = useListStaffAccessAccounts({
    query: { queryKey: getListStaffAccessAccountsQueryKey(), refetchOnWindowFocus: true },
  });
  const { data: professionals, isLoading: professionalsLoading } = useListProfessionals();
  const createAccount = useCreateStaffAccessAccount();
  const updateAccountMutation = useUpdateStaffAccessAccount();
  const resetPasswordMutation = useResetStaffAccessPassword();

  const [professionalId, setProfessionalId] = useState("");
  const [username, setUsername] = useState("");
  const [canAccessAgenda, setCanAccessAgenda] = useState(true);
  const [canAccessCommissions, setCanAccessCommissions] = useState(true);
  const [agendaScope, setAgendaScope] = useState<AgendaScope>("team");
  const [busyAccountId, setBusyAccountId] = useState<number | null>(null);
  const [credential, setCredential] = useState<TemporaryCredential | null>(null);

  const availableProfessionals = useMemo(
    () => (professionals ?? []).filter((professional) =>
      professional.active &&
      professional.id != null &&
      !(accounts ?? []).some((account) => account.professionalId === professional.id),
    ),
    [professionals, accounts],
  );

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedProfessional = availableProfessionals.find((item) => String(item.id) === professionalId);
    if (!selectedProfessional || !username.trim()) return;
    try {
      const result = await createAccount.mutateAsync({
        data: {
          professionalId: selectedProfessional.id!,
          username: username.trim(),
          canAccessAgenda,
          canAccessCommissions,
          agendaScope,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListStaffAccessAccountsQueryKey() });
      setCredential({ username: result.account.username, password: result.temporaryPassword, kind: "initial" });
      setProfessionalId("");
      setUsername("");
      setCanAccessAgenda(true);
      setCanAccessCommissions(true);
      setAgendaScope("team");
      toast({ title: "Acesso criado", description: "A senha padrão é a parte do e-mail antes do @ e será exibida uma única vez." });
    } catch (error) {
      toast({ title: "Não foi possível criar o acesso", description: apiErrorMessage(error), variant: "destructive" });
    }
  };

  const updateAccount = async (account: StaffAccessAccount, change: StaffAccessAccountUpdate) => {
    setBusyAccountId(account.id);
    try {
      const updated = await updateAccountMutation.mutateAsync({ id: account.id, data: change });
      queryClient.setQueryData<StaffAccessAccount[]>(
        getListStaffAccessAccountsQueryKey(),
        (current) => current?.map((item) => item.id === updated.id ? updated : item),
      );
      toast({ title: "Acesso atualizado" });
    } catch (error) {
      toast({ title: "Não foi possível atualizar o acesso", description: apiErrorMessage(error), variant: "destructive" });
    } finally {
      setBusyAccountId(null);
    }
  };

  const resetPassword = async (account: StaffAccessAccount) => {
    if (!window.confirm(`Gerar uma nova senha para ${account.username}? As sessões atuais serão encerradas.`)) return;
    setBusyAccountId(account.id);
    try {
      const result = await resetPasswordMutation.mutateAsync({ id: account.id });
      queryClient.setQueryData<StaffAccessAccount[]>(
        getListStaffAccessAccountsQueryKey(),
        (current) => current?.map((item) =>
          item.id === account.id ? { ...item, mustChangePassword: true } : item,
        ),
      );
      setCredential({ username: account.username, password: result.temporaryPassword, kind: "reset" });
    } catch (error) {
      toast({ title: "Não foi possível redefinir a senha", description: apiErrorMessage(error), variant: "destructive" });
    } finally {
      setBusyAccountId(null);
    }
  };

  const copyCredential = async () => {
    if (!credential) return;
    try {
      const passwordLabel = credential.kind === "initial" ? "Senha padrão" : "Senha temporária";
      await navigator.clipboard.writeText(`Usuário: ${credential.username}\n${passwordLabel}: ${credential.password}`);
      toast({ title: "Dados copiados" });
    } catch {
      toast({ title: "Não foi possível copiar", description: "Selecione e copie os dados exibidos.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Criar acesso profissional</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Cada acesso fica vinculado a uma profissional. A senha padrão é a parte do e-mail antes do @ e deverá ser trocada no primeiro acesso.
            </p>
          </div>
        </div>

        {professionalsLoading || accountsLoading ? (
          <p className="py-3 text-sm text-text-muted">Carregando profissionais...</p>
        ) : availableProfessionals.length === 0 ? (
          <p className="rounded-xl bg-surface-soft p-4 text-sm text-text-secondary">
            Todas as profissionais ativas já têm acesso ou ainda não há profissionais cadastradas.
          </p>
        ) : (
          <form onSubmit={(event) => void create(event)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-text-primary">
                Profissional
                <select
                  required
                  value={professionalId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    const selected = availableProfessionals.find((item) => String(item.id) === selectedId);
                    setProfessionalId(selectedId);
                    setUsername(selected ? toUsername(selected.name) : "");
                  }}
                  className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione uma profissional</option>
                  {availableProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id!}>{professional.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-text-primary">
                Usuário para entrar
                <Input
                  className="mt-2"
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Za-z0-9._-]+"
                  autoComplete="off"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.toLocaleLowerCase("en-US"))}
                  placeholder="ex.: marina.spa"
                />
              </label>
            </div>

            <div className="space-y-4 rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-semibold text-text-primary">Nível de acesso</p>
              <label className="flex items-start gap-3 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={canAccessAgenda}
                  onChange={(event) => setCanAccessAgenda(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">Agenda</span>
                  <span className="mt-0.5 block text-xs text-text-secondary">
                    Permite consultar, criar, editar, cancelar atendimentos e bloquear horários.
                  </span>
                </span>
              </label>
              {canAccessAgenda && (
                <div className="ml-7 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="agenda-scope"
                      checked={agendaScope === "own"}
                      onChange={() => setAgendaScope("own")}
                      className="accent-primary"
                    />
                    Somente a própria agenda
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="agenda-scope"
                      checked={agendaScope === "team"}
                      onChange={() => setAgendaScope("team")}
                      className="accent-primary"
                    />
                    Agenda de toda a equipe
                  </label>
                </div>
              )}
              <label className="flex items-start gap-3 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={canAccessCommissions}
                  onChange={(event) => setCanAccessCommissions(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block font-medium">Comissões</span>
                  <span className="mt-0.5 block text-xs text-text-secondary">
                    Mostra apenas as comissões desta profissional, sem permitir fechamentos ou pagamentos.
                  </span>
                </span>
              </label>
            </div>

            <Button disabled={createAccount.isPending || !professionalId}>
              {createAccount.isPending ? "Criando acesso..." : "Criar acesso"}
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-text-primary">Acessos cadastrados</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Alterações de permissão e desativação encerram as sessões abertas daquela conta.
          </p>
        </div>
        {accountsLoading ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-text-muted">Carregando acessos...</div>
        ) : !accounts?.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-text-secondary">
            Ainda não há contas profissionais.
          </div>
        ) : (
          accounts.map((account) => {
            const professional = professionals?.find((item) => item.id === account.professionalId);
            const busy = busyAccountId === account.id;
            return (
              <article key={account.id} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="font-semibold text-text-primary">
                      {professional?.name ?? "Profissional não encontrada"}
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      Usuário: <span className="font-medium text-text-primary">{account.username}</span>
                      {account.mustChangePassword && (
                        <span className="ml-2 inline-flex rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                          Troca de senha pendente
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void resetPassword(account)}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Redefinir senha
                    </Button>
                    <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={account.active}
                        disabled={busy || !professional?.active}
                        onChange={(event) => void updateAccount(account, { active: event.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      Ativo
                    </label>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <label className="flex items-start gap-3 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={account.canAccessAgenda}
                      disabled={busy || !account.active}
                      onChange={(event) => void updateAccount(account, { canAccessAgenda: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">Agenda</span>
                      <span className="mt-0.5 block text-xs text-text-secondary">
                        {account.agendaScope === "own" ? "Somente a própria agenda" : "Toda a equipe"}
                      </span>
                    </span>
                  </label>
                  {account.canAccessAgenda && (
                    <label className="block text-sm font-medium text-text-primary">
                      Alcance da agenda
                      <select
                        value={account.agendaScope as AgendaScope}
                        disabled={busy || !account.active}
                        onChange={(event) => void updateAccount(account, { agendaScope: event.target.value as AgendaScope })}
                        className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="own">Somente a própria agenda</option>
                        <option value="team">Agenda de toda a equipe</option>
                      </select>
                    </label>
                  )}
                  <label className="flex items-start gap-3 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      checked={account.canAccessCommissions}
                      disabled={busy || !account.active}
                      onChange={(event) => void updateAccount(account, { canAccessCommissions: event.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">Comissões</span>
                      <span className="mt-0.5 block text-xs text-text-secondary">Somente as próprias comissões</span>
                    </span>
                  </label>
                </div>
              </article>
            );
          })
        )}
      </section>

      <Dialog open={Boolean(credential)} onOpenChange={(open) => !open && setCredential(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{credential?.kind === "initial" ? "Senha padrão" : "Senha temporária"}</DialogTitle>
            <DialogDescription>
              {credential?.kind === "initial"
                ? "A senha é a parte do e-mail profissional antes do @. Envie os dados por um canal seguro; a senha deverá ser trocada no primeiro acesso."
                : "Envie estes dados à profissional por um canal seguro. A senha deverá ser trocada no próximo acesso."}
            </DialogDescription>
          </DialogHeader>
          {credential && (
            <div className="space-y-3 rounded-xl border border-border bg-background p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Usuário</p>
                <p className="mt-1 font-medium text-text-primary">{credential.username}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {credential.kind === "initial" ? "Senha padrão" : "Senha temporária"}
                </p>
                <code className="mt-1 block break-all rounded-lg bg-surface-soft p-3 font-mono text-sm text-text-primary">
                  {credential.password}
                </code>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredential(null)}>Fechar</Button>
            <Button onClick={() => void copyCredential()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}