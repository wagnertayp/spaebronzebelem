import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useManageArchivedRecords,
  type ArchiveMutationInputAction,
  type ArchiveRecordRef,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type ArchiveAction = ArchiveMutationInputAction;
type BulkArchiveSelectionOptions = {
  records: ArchiveRecordRef[];
  action: ArchiveAction;
};

const recordKey = (record: ArchiveRecordRef) => `${record.entity}:${record.id}`;

export function useBulkArchiveSelection({ records, action }: BulkArchiveSelectionOptions) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutation = useManageArchivedRecords();

  const signature = records.map(recordKey).join("\u001f");
  const visibleRecords = useMemo(() => records, [signature]);
  const visibleKeys = useMemo(
    () => new Set(visibleRecords.map(recordKey)),
    [visibleRecords],
  );

  useEffect(() => {
    setSelectedKeys((current) => {
      const next = new Set([...current].filter((key) => visibleKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [visibleKeys]);

  const selectedRecords = useMemo(
    () => visibleRecords.filter((record) => selectedKeys.has(recordKey(record))),
    [selectedKeys, visibleRecords],
  );
  const allVisibleSelected =
    visibleRecords.length > 0 &&
    visibleRecords.every((record) => selectedKeys.has(recordKey(record)));

  const toggleRecord = useCallback((record: ArchiveRecordRef) => {
    const key = recordKey(record);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const record of visibleRecords) next.delete(recordKey(record));
      } else {
        for (const record of visibleRecords) next.add(recordKey(record));
      }
      return next;
    });
  }, [allVisibleSelected, visibleRecords]);

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), []);
  const isSelected = useCallback(
    (record: ArchiveRecordRef) => selectedKeys.has(recordKey(record)),
    [selectedKeys],
  );

  const execute = useCallback(async () => {
    if (selectedRecords.length === 0) return;
    try {
      const result = await mutation.mutateAsync({
        data: { action, records: selectedRecords },
      });
      await queryClient.invalidateQueries();
      clearSelection();
      const verb = action === "archive" ? "arquivado(s)" : "restaurado(s)";
      toast({
        title: `${result.changedCount} registro(s) ${verb}`,
        description:
          result.changedCount === 0
            ? "Nenhum item precisou ser alterado."
            : "A alteração foi salva e os dados foram preservados.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível concluir a ação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }, [action, clearSelection, mutation, queryClient, selectedRecords, toast]);

  return {
    action,
    allVisibleSelected,
    clearSelection,
    execute,
    isPending: mutation.isPending,
    isSelected,
    selectedCount: selectedRecords.length,
    toggleAllVisible,
    toggleRecord,
    totalCount: visibleRecords.length,
  };
}

export type BulkArchiveSelection = ReturnType<typeof useBulkArchiveSelection>;