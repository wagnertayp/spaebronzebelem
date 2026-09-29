import { useMemo, useState } from "react";
import { Archive, Loader2, Search } from "lucide-react";
import { useListArchivedRecords, type ArchiveRecordRef } from "@workspace/api-client-react";
import { BulkArchiveToolbar } from "@/components/archive/bulk-archive-toolbar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBulkArchiveSelection } from "@/hooks/use-bulk-archive-selection";

const entityLabels: Record<ArchiveRecordRef["entity"], string> = {
  appointment: "Agendamento",
  client: "Cliente",
  lead: "Lead",
  service: "Serviço",
  quote: "Orçamento",
  financialMovement: "Movimentação financeira",
  professional: "Profissional",
  commissionRule: "Regra de comissão",
  inventory: "Estoque",
  whatsappConversation: "Conversa do WhatsApp",
};

export function Arquivo() {
  const { data: archived = [], isLoading, isError, refetch } = useListArchivedRecords();
  const [search, setSearch] = useState("");
  const [entity, setEntity] = useState<"all" | ArchiveRecordRef["entity"]>("all");

  const visible = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return archived.filter((record) => {
      const matchesEntity = entity === "all" || record.entity === entity;
      const matchesSearch =
        !normalizedSearch ||
        `${record.label} ${entityLabels[record.entity]}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalizedSearch);
      return matchesEntity && matchesSearch;
    });
  }, [archived, entity, search]);

  const selection = useBulkArchiveSelection({
    action: "restore",
    records: visible.map(({ entity: recordEntity, id }) => ({
      entity: recordEntity,
      id,
    })),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arquivo"
        description="Registros arquivados ficam preservados e podem ser restaurados a qualquer momento."
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar no arquivo..."
            aria-label="Buscar registros arquivados"
            className="pl-9"
          />
        </div>
        <select
          value={entity}
          onChange={(event) => setEntity(event.target.value as typeof entity)}
          aria-label="Filtrar por tipo de registro"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-text-primary"
        >
          <option value="all">Todos os tipos</option>
          {Object.entries(entityLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <BulkArchiveToolbar selection={selection} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Carregando arquivo...
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-secondary">Não foi possível carregar os registros arquivados.</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Archive className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
          <p className="mt-3 font-medium text-text-primary">
            {archived.length === 0 ? "Nenhum registro arquivado" : "Nenhum resultado encontrado"}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            {archived.length === 0
              ? "Quando você arquivar registros, eles aparecerão aqui para restauração."
              : "Altere a busca ou o tipo de registro selecionado."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border">
            {visible.map((record) => {
              const ref: ArchiveRecordRef = { entity: record.entity, id: record.id };
              const checked = selection.isSelected(ref);
              const archivedDate = new Date(record.archivedAt);
              const archivedLabel = Number.isNaN(archivedDate.getTime())
                ? "Data indisponível"
                : new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(archivedDate);
              return (
                <label
                  key={`${record.entity}:${record.id}`}
                  className="flex cursor-pointer items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:items-center"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => selection.toggleRecord(ref)}
                    aria-label={`Selecionar ${entityLabels[record.entity]}: ${record.label}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary sm:mt-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                        {entityLabels[record.entity]}
                      </span>
                      <span className="truncate font-medium text-text-primary">{record.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-text-muted">Arquivado em {archivedLabel}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}