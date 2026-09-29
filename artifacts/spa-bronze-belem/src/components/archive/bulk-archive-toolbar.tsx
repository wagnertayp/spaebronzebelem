import { useState } from "react";
import { Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { BulkArchiveSelection } from "@/hooks/use-bulk-archive-selection";

export function BulkArchiveToolbar({
  selection,
}: {
  selection: BulkArchiveSelection;
}) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  if (selection.totalCount === 0) return null;

  const restoring = selection.action === "restore";
  const actionLabel = restoring ? "Restaurar selecionados" : "Arquivar selecionados";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <p className="text-sm text-text-secondary" aria-live="polite">
          <span className="font-semibold text-text-primary">{selection.selectedCount}</span>
          {" de "}
          {selection.totalCount} visível(is) selecionado(s)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={selection.toggleAllVisible}
            disabled={selection.isPending}
          >
            {selection.allVisibleSelected ? "Desmarcar visíveis" : "Selecionar todos visíveis"}
          </Button>
          {selection.selectedCount > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => setConfirmationOpen(true)}
              disabled={selection.isPending}
            >
              {restoring ? (
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              ) : (
                <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {actionLabel}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {restoring ? "Restaurar registros selecionados?" : "Arquivar registros selecionados?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {restoring
                ? "Os registros voltarão às listas correspondentes. Nenhum dado será apagado."
                : "Os registros sairão das listas ativas, mas poderão ser restaurados no Arquivo. Nenhum dado será apagado."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={selection.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={selection.isPending}
              onClick={() => {
                setConfirmationOpen(false);
                void selection.execute();
              }}
            >
              {selection.isPending ? "Salvando..." : restoring ? "Restaurar" : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}