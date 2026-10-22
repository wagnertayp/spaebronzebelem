import {
  getListWalkInQueueQueryKey,
  useListWalkInQueue,
  useUpdateWalkInQueueEntry,
  type WalkInQueueEntry,
  type WalkInQueueStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, LoaderCircle, Phone, Play, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { useToast } from "@/hooks/use-toast";

const statusLabel: Record<WalkInQueueStatus, string> = {
  waiting: "Aguardando",
  in_service: "Em atendimento",
  completed: "Concluído",
  canceled: "Cancelado",
};

const formatArrivalTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));

export function AtendimentoFila() {
  const [showHistory, setShowHistory] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data = [], isLoading, isError, refetch, isFetching } = useListWalkInQueue({
    query: { queryKey: getListWalkInQueueQueryKey(), refetchInterval: 15_000 },
  });
  const updateEntry = useUpdateWalkInQueueEntry({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListWalkInQueueQueryKey() });
        toast({ title: "Fila atualizada" });
      },
      onError: () => toast({ title: "Não foi possível atualizar a fila", variant: "destructive" }),
    },
  });

  const entries = [...data].sort(
    (a: WalkInQueueEntry, b: WalkInQueueEntry) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const activeEntries = entries.filter((entry) => entry.status === "waiting" || entry.status === "in_service");
  const historyEntries = entries.filter((entry) => entry.status === "completed" || entry.status === "canceled");
  const visibleEntries = showHistory ? historyEntries : activeEntries;

  const changeStatus = (id: number, status: WalkInQueueStatus) =>
    updateEntry.mutate({ id, data: { status } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila de atendimento"
        description="Clientes que confirmaram a ida para bronze por ordem de chegada."
      />

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-secondary">
              {showHistory ? "Histórico" : "Aguardando atendimento"}
            </p>
            <p className="mt-1 text-3xl font-semibold text-text-primary">
              {showHistory ? historyEntries.length : activeEntries.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShowHistory((value) => !value)}>
              {showHistory ? "Ver fila ativa" : "Ver histórico"}
            </Button>
            <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-10 text-text-secondary">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Carregando a fila…
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-error/20 bg-error/5 p-6 text-sm text-error">
          Não foi possível carregar a fila. Tente atualizar novamente.
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <Clock3 className="mx-auto h-8 w-8 text-text-muted" />
          <h2 className="mt-3 font-semibold text-text-primary">
            {showHistory ? "Ainda não há atendimentos finalizados" : "A fila está vazia"}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Clientes entram aqui depois de confirmar que irão ao bronze e informar que não estão grávidas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-text-primary">{entry.clientName}</h2>
                    <span className="rounded-full bg-primary-soft/40 px-2.5 py-1 text-xs font-medium text-primary-dark">
                      {statusLabel[entry.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-secondary">{entry.service}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-secondary">
                    <a className="inline-flex items-center gap-1.5 hover:text-primary" href={`tel:${entry.phone}`}>
                      <Phone className="h-4 w-4" /> {entry.phone}
                    </a>
                    <span>Confirmou às {formatArrivalTime(entry.createdAt)}</span>
                  </div>
                </div>
                {!showHistory && (
                  <div className="flex flex-wrap gap-2">
                    {entry.status === "waiting" && (
                      <Button
                        onClick={() => changeStatus(entry.id, "in_service")}
                        disabled={updateEntry.isPending}
                      >
                        <Play className="mr-2 h-4 w-4" /> Iniciar atendimento
                      </Button>
                    )}
                    {entry.status === "in_service" && (
                      <Button
                        onClick={() => changeStatus(entry.id, "completed")}
                        disabled={updateEntry.isPending}
                      >
                        <Check className="mr-2 h-4 w-4" /> Finalizar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => changeStatus(entry.id, "canceled")}
                      disabled={updateEntry.isPending}
                    >
                      <X className="mr-2 h-4 w-4" /> Remover
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
