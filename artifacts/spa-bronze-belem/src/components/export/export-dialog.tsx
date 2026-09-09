import { useEffect, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultFilename: string;
  count: number;
  children?: ReactNode;
  onExport: (filename: string) => void;
};

export function ExportDialog({
  open,
  onOpenChange,
  title,
  defaultFilename,
  count,
  children,
  onExport,
}: ExportDialogProps) {
  const [filename, setFilename] = useState(defaultFilename);

  useEffect(() => {
    if (open) setFilename(defaultFilename);
  }, [open, defaultFilename]);

  const canExport = count > 0 && filename.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="export-filename" className="text-sm font-medium text-text-primary">Nome do arquivo</label>
            <Input
              id="export-filename"
              value={filename}
              onChange={event => setFilename(event.target.value)}
              placeholder="nome-do-arquivo"
            />
            <p className="text-xs text-text-muted">A extensão .csv será adicionada automaticamente.</p>
          </div>
          {children}
          <p className="rounded-md bg-primary-soft/50 px-3 py-2 text-sm text-text-secondary">
            {count} {count === 1 ? 'registro será exportado' : 'registros serão exportados'}.
          </p>
          {count === 0 && (
            <p className="text-sm text-error">Ajuste os filtros para selecionar ao menos um registro.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!canExport} onClick={() => { onExport(`${filename.trim().replace(/\.csv$/i, '')}.csv`); onOpenChange(false); }}>
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}