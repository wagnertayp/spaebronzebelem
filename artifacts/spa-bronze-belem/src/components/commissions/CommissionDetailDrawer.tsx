import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Professional, CommissionItemStatus, useGetCommissionsSummary, useListCommissionClosures, useCloseCommissionPeriod, usePayCommissionPeriod, useReopenCommissionPeriod, getGetCommissionsSummaryQueryKey, getListCommissionClosuresQueryKey, useListCommissionAudit, getListCommissionAuditQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "./utils";
import { AlertCircle, History, Lock, Unlock, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: Professional | null;
  period: { from: string; to: string } | null;
  statusFilter: 'all' | 'open' | 'closed' | 'paid';
  readOnly?: boolean;
}

export function CommissionDetailDrawer({ open, onOpenChange, professional, period, statusFilter, readOnly = false }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);

  const [payForm, setPayForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), method: "pix", note: "" });
  const [dueDate, setDueDate] = useState("");

  const pId = professional?.id;
  const from = period?.from;
  const to = period?.to;

  const apiStatus = statusFilter === 'open' ? 'eligible' : statusFilter === 'closed' ? 'closed' : statusFilter === 'paid' ? 'paid' : undefined;

  const { data: summary, isLoading: loadingSummary } = useGetCommissionsSummary(
    { from: from!, to: to!, professionalId: pId, status: apiStatus as CommissionItemStatus },
    { 
      query: { 
        enabled: !!pId && !!from && !!to,
        queryKey: getGetCommissionsSummaryQueryKey({ from: from!, to: to!, professionalId: pId, status: apiStatus as CommissionItemStatus })
      } 
    }
  );

  const { data: closures = [], isLoading: loadingClosures } = useListCommissionClosures(
    { professionalId: pId, from, to },
    { 
      query: { 
        enabled: !!pId && !!from && !!to,
        queryKey: getListCommissionClosuresQueryKey({ professionalId: pId, from, to })
      } 
    }
  );

  // Consider the main closure as the first one matching the period
  const closure = closures.find(c => c.from === from && c.to === to);
  const closureStatus = closure?.status || (summary?.items.some(i => i.status === 'eligible') ? 'open' : 'empty');

  const { data: audits = [] } = useListCommissionAudit(
    { professionalId: pId, closureId: closure?.id },
    { 
      query: { 
        enabled: !!closure?.id,
        queryKey: getListCommissionAuditQueryKey({ professionalId: pId, closureId: closure?.id })
      } 
    }
  );

  const closeMutation = useCloseCommissionPeriod();
  const payMutation = usePayCommissionPeriod();
  const reopenMutation = useReopenCommissionPeriod();

  const handleClose = () => {
    if (!pId || !from || !to) return;
    closeMutation.mutate(
      { data: { professionalId: pId, from, to, dueDate: dueDate || to } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCommissionsSummaryQueryKey({ from, to, professionalId: pId }) });
          queryClient.invalidateQueries({ queryKey: getListCommissionClosuresQueryKey({ professionalId: pId, from, to }) });
          setCloseConfirmOpen(false);
          toast({ title: "Comissão fechada com sucesso!" });
        }
      }
    );
  };

  const handlePay = () => {
    if (!closure?.id || !pId || !from || !to) return;
    payMutation.mutate(
      { id: closure.id, data: { paymentDate: payForm.date, paymentMethod: payForm.method as any, note: payForm.note } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCommissionsSummaryQueryKey({ from, to, professionalId: pId }) });
          queryClient.invalidateQueries({ queryKey: getListCommissionClosuresQueryKey({ professionalId: pId, from, to }) });
          setPayModalOpen(false);
          toast({ title: "Pagamento registrado com sucesso!" });
        }
      }
    );
  };

  const handleReopen = () => {
    if (!closure?.id || !pId || !from || !to) return;
    reopenMutation.mutate(
      { id: closure.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCommissionsSummaryQueryKey({ from, to, professionalId: pId }) });
          queryClient.invalidateQueries({ queryKey: getListCommissionClosuresQueryKey({ professionalId: pId, from, to }) });
          setReopenConfirmOpen(false);
          toast({ title: "Fechamento reaberto." });
        }
      }
    );
  };

  if (!professional || !period) return null;

  const totalProduction = summary?.items.reduce((acc, item) => acc + (item.baseAmount || 0), 0) || 0;
  const totalCommission = summary?.items.reduce((acc, item) => acc + (item.commissionAmount || 0), 0) || 0;
  const effectiveRate = totalProduction > 0 ? (totalCommission / totalProduction) * 100 : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="!w-full max-w-none sm:!w-[800px] sm:!max-w-[calc(100vw-2rem)] bg-surface border-border overflow-y-auto overflow-x-hidden p-0 sm:p-6">
          <div className="bg-surface-soft p-4 sm:p-6 border-b border-border sticky top-0 z-10 flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold text-text-primary uppercase">COMISSÃO — {professional.name}</h2>
              <div className="text-sm text-text-secondary mt-1">
                Período: {format(parseISO(period.from), "dd/MM/yyyy")} → {format(parseISO(period.to), "dd/MM/yyyy")}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase text-text-muted">STATUS:</span>
              {readOnly && (
                <span className="rounded-md bg-surface-soft px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  SOMENTE LEITURA
                </span>
              )}
              {closureStatus === 'open' && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-warning/10 text-warning flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> EM ABERTO
                </span>
              )}
              {closureStatus === 'closed' && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-primary/10 text-primary flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> FECHADA
                </span>
              )}
              {closureStatus === 'paid' && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-success/10 text-success flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> PAGA
                </span>
              )}
              {closureStatus === 'empty' && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-text-muted/10 text-text-muted">
                  SEM REGISTROS
                </span>
              )}

              {!readOnly && (
                <div className="ml-auto flex gap-2">
                  {closureStatus === 'open' && summary && summary.items.length > 0 && (
                    <Button size="sm" onClick={() => { setDueDate(to || ""); setCloseConfirmOpen(true); }}>
                      <Lock className="w-4 h-4 mr-1.5" /> Fechar comissão
                    </Button>
                  )}
                  {closureStatus === 'closed' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setReopenConfirmOpen(true)}>
                        <Unlock className="w-4 h-4 mr-1.5" /> Reabrir
                      </Button>
                      <Button size="sm" className="bg-success hover:bg-success-dark text-white" onClick={() => setPayModalOpen(true)}>
                        Registrar pagamento
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2 uppercase mb-4 tracking-wide">
                Resumo
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-text-muted uppercase mb-1">Atendimentos</div>
                  <div className="text-lg font-medium">{summary?.items.length || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted uppercase mb-1">Produção</div>
                  <div className="text-lg font-medium">{formatCurrency(totalProduction)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted uppercase mb-1">Base de Comissão</div>
                  <div className="text-lg font-medium">{formatCurrency(totalProduction)}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted uppercase mb-1">Comissão Total</div>
                  <div className="text-lg font-bold text-primary-dark">{formatCurrency(totalCommission)}</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2 uppercase mb-4 tracking-wide">
                Atendimentos
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-left border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-surface-soft/50 border-b border-border text-text-secondary uppercase">
                      <th className="py-2.5 px-3 font-medium">Data</th>
                      <th className="py-2.5 px-3 font-medium">Serviço</th>
                      <th className="py-2.5 px-3 font-medium text-right">Base</th>
                      <th className="py-2.5 px-3 font-medium text-right">Taxa</th>
                      <th className="py-2.5 px-3 font-medium text-right">Comissão</th>
                      <th className="py-2.5 px-3 font-medium text-center">Origem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {summary?.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-text-muted">
                          Nenhum atendimento no período.
                        </td>
                      </tr>
                    ) : (
                      summary?.items.map(item => (
                        <tr key={item.id} className={cn("hover:bg-surface-soft/30", item.status === 'blocked' && "bg-error/5")}>
                          <td className="py-2.5 px-3 text-text-secondary">{item.date ? format(parseISO(item.date), "dd/MM") : '-'}</td>
                          <td className="py-2.5 px-3 font-medium text-text-primary">{item.serviceName}</td>
                          <td className="py-2.5 px-3 text-right">{formatCurrency(item.baseAmount)}</td>
                          <td className="py-2.5 px-3 text-right text-text-secondary">
                            {item.rateType === 'percent' ? `${item.rateValue}%` : formatCurrency(item.rateValue)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-primary-dark">{formatCurrency(item.commissionAmount)}</td>
                          <td className="py-2.5 px-3 text-center">
                            {item.status === 'blocked' ? (
                              <span className="text-error flex items-center justify-center gap-1" title={item.blockedReason || ''}>
                                <AlertCircle className="w-3 h-3" /> Bloqueado
                              </span>
                            ) : (
                              <span className="text-text-muted">Agenda</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {audits.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2 uppercase mb-4 tracking-wide flex items-center gap-2">
                  <History className="w-4 h-4" /> Histórico / Auditoria
                </h3>
                <div className="space-y-3">
                  {audits.map(audit => (
                    <div key={audit.id} className="text-[12px] p-2.5 rounded bg-surface-soft/50 border border-border flex items-start justify-between">
                      <div>
                        <span className="font-semibold text-text-primary mr-1">{audit.username}</span>
                        <span className="text-text-secondary">
                          {audit.action === 'close' ? 'fechou o período.' : 
                           audit.action === 'pay' ? 'registrou pagamento.' :
                           audit.action === 'reopen' ? 'reabriu o período.' : 'alterou configurações.'}
                        </span>
                      </div>
                      <span className="text-text-muted whitespace-nowrap">{format(parseISO(audit.timestamp), "dd/MM HH:mm")}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Close Confirmation Dialog */}
      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="max-w-sm bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Fechar comissão?</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-[14px] text-text-secondary">
            <p className="mb-4">
              Após o fechamento, os valores deste período serão registrados e não poderão ser alterados sem reabrir o fechamento.
            </p>
            <div className="p-3 bg-surface-soft rounded-lg space-y-2 text-text-primary">
              <div className="flex justify-between"><span>Profissional:</span> <span className="font-semibold">{professional.name}</span></div>
              <div className="flex justify-between"><span>Produção:</span> <span className="font-semibold">{formatCurrency(totalProduction)}</span></div>
              <div className="flex justify-between text-primary-dark"><span>Comissão:</span> <span className="font-bold">{formatCurrency(totalCommission)}</span></div>
            </div>
            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Vencimento da obrigação</label>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              <p className="text-xs text-text-muted">Esta data será usada no lançamento do Financeiro.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleClose} disabled={closeMutation.isPending || !dueDate}>Fechar comissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Modal */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-sm bg-surface border-border">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-center p-4 bg-primary/10 rounded-lg text-primary-dark mb-2">
              <div className="text-xs uppercase font-medium mb-1">Valor a pagar</div>
              <div className="text-3xl font-bold">{formatCurrency(closure?.totalAmount)}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Data do pagamento</label>
              <Input type="date" value={payForm.date} onChange={e => setPayForm(prev => ({...prev, date: e.target.value}))} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Forma de pagamento</label>
              <Select value={payForm.method} onValueChange={v => setPayForm(prev => ({...prev, method: v}))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="card">Cartão</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-primary">Observação (opcional)</label>
              <Input value={payForm.note} onChange={e => setPayForm(prev => ({...prev, note: e.target.value}))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayModalOpen(false)}>Cancelar</Button>
            <Button className="bg-success hover:bg-success-dark text-white" onClick={handlePay} disabled={payMutation.isPending}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Confirmation Dialog */}
      <Dialog open={reopenConfirmOpen} onOpenChange={setReopenConfirmOpen}>
        <DialogContent className="max-w-sm bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-error flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Reabrir comissão?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-[14px] text-text-secondary">
            <p>
              Isso fará com que o período volte a ficar <strong>EM ABERTO</strong>. O sistema poderá recalcular os valores se houverem novos atendimentos ou alterações nas regras.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenConfirmOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReopen} disabled={reopenMutation.isPending}>Sim, reabrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
