import { useMemo } from "react";
import { useGetCommissionsSummary, getGetCommissionsSummaryQueryKey, useListProfessionals, Professional, CommissionItemStatus } from "@workspace/api-client-react";
import { formatCurrency } from "./utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarIcon, Eye, Search, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Period = 'today' | 'month' | 'custom';
type TabStatus = 'all' | 'open' | 'closed' | 'paid';

interface Props {
  period: Period;
  setPeriod: (v: Period) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
  statusFilter: TabStatus;
  setStatusFilter: (v: TabStatus) => void;
  profFilter: string;
  setProfFilter: (v: string) => void;
  dateRange: { from: string; to: string };
  validDates: boolean;
  apiStatus: string | undefined;
  pId: number | undefined;
  onViewDetails: (prof: Professional, period: { from: string; to: string }, status: TabStatus) => void;
}

export function CommissionsTab({ 
  period, setPeriod, 
  customFrom, setCustomFrom, 
  customTo, setCustomTo, 
  statusFilter, setStatusFilter, 
  profFilter, setProfFilter, 
  dateRange, validDates, apiStatus, pId,
  onViewDetails 
}: Props) {
  
  const { data: professionals = [] } = useListProfessionals();

  const { data: summary, isLoading } = useGetCommissionsSummary(
    { from: dateRange.from, to: dateRange.to, status: apiStatus as CommissionItemStatus, professionalId: pId },
    { 
      query: { 
        enabled: validDates,
        queryKey: getGetCommissionsSummaryQueryKey({ from: dateRange.from, to: dateRange.to, status: apiStatus as CommissionItemStatus, professionalId: pId })
      } 
    }
  );

  const stats = useMemo(() => {
    if (!summary) return { total: 0, aPagar: 0, pago: 0, count: 0 };
    let aPagar = 0;
    let pago = 0;
    summary.items.forEach(item => {
      if (item.status === 'paid') pago += item.commissionAmount || 0;
      else if (item.status === 'eligible' || item.status === 'closed') aPagar += item.commissionAmount || 0;
    });
    return {
      total: summary.totalAmount,
      aPagar,
      pago,
      count: summary.itemCount,
    };
  }, [summary]);

  const tableData = useMemo(() => {
    if (!summary?.items) return [];
    const profs: Record<number, { profId: number; name: string; production: number; commission: number; statuses: Set<string> }> = {};
    
    summary.items.forEach(item => {
      if (!profs[item.professionalId]) {
        profs[item.professionalId] = { 
          profId: item.professionalId, 
          name: item.professionalName, 
          production: 0, 
          commission: 0, 
          statuses: new Set() 
        };
      }
      profs[item.professionalId].production += item.baseAmount || 0;
      profs[item.professionalId].commission += item.commissionAmount || 0;
      profs[item.professionalId].statuses.add(item.status);
    });

    return Object.values(profs).sort((a, b) => b.commission - a.commission).map(p => {
      let statusDisplay = 'EM ABERTO';
      let statusClass = 'bg-warning/10 text-warning';
      
      if (p.statuses.has('eligible')) {
        statusDisplay = 'EM ABERTO';
        statusClass = 'bg-warning/10 text-warning';
      } else if (p.statuses.has('closed') && !p.statuses.has('paid')) {
        statusDisplay = 'FECHADA';
        statusClass = 'bg-primary/10 text-primary';
      } else if (p.statuses.has('paid') && !p.statuses.has('closed') && !p.statuses.has('eligible')) {
        statusDisplay = 'PAGA';
        statusClass = 'bg-success/10 text-success';
      } else {
        statusDisplay = 'MISTO';
        statusClass = 'bg-text-muted/10 text-text-muted';
      }

      return { ...p, statusDisplay, statusClass };
    });
  }, [summary]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-surface rounded-xl border border-border p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-text-secondary">Período</label>
            <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === 'custom' && (
            <>
              <div className="space-y-1.5 min-w-[140px]">
                <label className="text-xs font-medium text-text-secondary">De</label>
                <div className="relative">
                  <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-9 pl-8 bg-background text-sm" />
                  <CalendarIcon className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5 min-w-[140px]">
                <label className="text-xs font-medium text-text-secondary">Até</label>
                <div className="relative">
                  <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-9 pl-8 bg-background text-sm" />
                  <CalendarIcon className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-text-secondary">Profissional</label>
            <Select value={profFilter} onValueChange={setProfFilter}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {professionals.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 flex-1 min-w-[150px]">
            <label className="text-xs font-medium text-text-secondary">Status</label>
            <Select value={statusFilter} onValueChange={(v: TabStatus) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Em aberto</SelectItem>
                <SelectItem value="closed">Fechada</SelectItem>
                <SelectItem value="paid">Paga</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {period === 'custom' && !validDates && customFrom && customTo && (
          <div className="text-error text-[12px] flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> A data inicial deve ser anterior ou igual à data final.
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-background shadow-sm border-border">
          <div className="text-[12px] font-medium text-text-secondary mb-1 uppercase">COMISSÕES DO PERÍODO</div>
          <div className="text-[22px] font-semibold text-text-primary">
            {isLoading ? '...' : formatCurrency(stats.total)}
          </div>
        </Card>
        <Card className="p-5 bg-primary/10 shadow-sm border-primary/20">
          <div className="text-[12px] font-medium text-primary-dark mb-1 uppercase">A PAGAR</div>
          <div className="text-[22px] font-semibold text-primary-dark">
            {isLoading ? '...' : formatCurrency(stats.aPagar)}
          </div>
        </Card>
        <Card className="p-5 bg-success/10 shadow-sm border-success/20">
          <div className="text-[12px] font-medium text-success-dark mb-1 uppercase" style={{color: 'var(--success)'}}>JÁ PAGO</div>
          <div className="text-[22px] font-semibold text-success">
            {isLoading ? '...' : formatCurrency(stats.pago)}
          </div>
        </Card>
        <Card className="p-5 bg-background shadow-sm border-border">
          <div className="text-[12px] font-medium text-text-secondary mb-1 uppercase">ATENDIMENTOS COM COMISSÃO</div>
          <div className="text-[22px] font-semibold text-text-primary">
            {isLoading ? '...' : stats.count}
          </div>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="h-64 bg-surface-soft animate-pulse rounded-xl" />
      ) : tableData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-surface rounded-xl border border-border">
          <Search className="w-10 h-10 text-text-muted mb-4" />
          <h3 className="text-[15px] font-medium text-text-primary mb-1">Nenhuma comissão encontrada</h3>
          <p className="text-[14px] text-text-secondary max-w-md text-center">
            Não há registros que correspondam aos filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="bg-surface-soft/50 border-b border-border text-text-secondary">
                  <th className="py-3 px-4 font-medium uppercase text-[11px] tracking-wider">Profissional</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px] tracking-wider text-right">Produção</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px] tracking-wider text-right">Comissão</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px] tracking-wider text-center">Status</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px] tracking-wider text-right w-32">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tableData.map(row => (
                  <tr key={row.profId} className="hover:bg-surface-soft/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-text-primary">{row.name}</td>
                    <td className="py-3 px-4 text-right text-text-secondary">{formatCurrency(row.production)}</td>
                    <td className="py-3 px-4 text-right font-medium text-text-primary">{formatCurrency(row.commission)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={cn("px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase", row.statusClass)}>
                        {row.statusDisplay}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-[12px] h-8"
                        onClick={() => {
                          const prof = professionals.find(p => p.id === row.profId);
                          if (prof) onViewDetails(prof, dateRange, statusFilter);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Ver detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
