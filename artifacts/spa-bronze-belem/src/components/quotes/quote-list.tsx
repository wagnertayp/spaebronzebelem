import { useState, useMemo } from 'react';
import { useListQuotes, QuoteStatus } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Plus, Search, Filter, TrendingUp, CheckCircle, Clock, XCircle, FileText, ArrowRight, ArrowUpRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Link } from 'wouter';

export function QuoteList() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [periodDays, setPeriodDays] = useState<number>(30);
  
  // Real parameters for the API
  const fromDate = useMemo(() => subDays(new Date(), periodDays).toISOString(), [periodDays]);
  const { data: quotes = [], isLoading } = useListQuotes({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    from: fromDate
  });

  const stats = useMemo(() => {
    let drafts = 0;
    let sent = 0;
    let approved = 0;
    let approvedValue = 0;
    let totalCount = quotes.length;
    let totalValue = 0;

    quotes.forEach(q => {
      totalValue += q.total;
      if (q.status === 'draft') drafts++;
      if (q.status === 'sent') sent++;
      if (q.status === 'approved') {
        approved++;
        approvedValue += q.total;
      }
    });

    const conversionRate = totalCount > 0 ? (approved / totalCount) * 100 : 0;
    const ticketMedio = totalCount > 0 ? totalValue / totalCount : 0;

    return {
      drafts,
      sent,
      approved,
      approvedValue,
      conversionRate,
      ticketMedio
    };
  }, [quotes]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success border-success/20';
      case 'rejected': return 'bg-error/10 text-error border-error/20';
      case 'sent': return 'bg-primary/10 text-primary-dark border-primary/20';
      case 'viewed': return 'bg-accent/10 text-accent border-accent/20';
      case 'draft': return 'bg-surface border-border text-text-secondary';
      case 'expired': return 'bg-text-muted/10 text-text-secondary border-text-muted/20';
      case 'cancelled': return 'bg-text-muted/10 text-text-muted border-text-muted/20';
      default: return 'bg-surface border-border text-text-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Recusado';
      case 'sent': return 'Enviado';
      case 'viewed': return 'Visualizado';
      case 'draft': return 'Rascunho';
      case 'expired': return 'Expirado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-10">
      <PageHeader 
        title="Orçamentos"
        description="Gerencie propostas, acompanhe aprovações e converta orçamentos em vendas."
        action={
          <button 
            onClick={() => setLocation('/servicos?action=create')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button"
          >
            <Plus className="w-[18px] h-[18px]" />
            Novo orçamento
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 flex flex-col gap-1 border-border/60 shadow-sm">
          <span className="text-[13px] font-medium text-text-secondary">Rascunhos</span>
          <span className="text-[24px] font-bold text-text-primary">{stats.drafts}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-border/60 shadow-sm">
          <span className="text-[13px] font-medium text-text-secondary">Enviados</span>
          <span className="text-[24px] font-bold text-text-primary">{stats.sent}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-border/60 shadow-sm bg-success/5 border-success/20">
          <span className="text-[13px] font-medium text-success">Aprovados</span>
          <span className="text-[24px] font-bold text-success">{stats.approved}</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-border/60 shadow-sm">
          <span className="text-[13px] font-medium text-text-secondary">Taxa de Conversão</span>
          <span className="text-[24px] font-bold text-text-primary">{stats.conversionRate.toFixed(1)}%</span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-border/60 shadow-sm">
          <span className="text-[13px] font-medium text-text-secondary">Ticket Médio</span>
          <span className="text-[20px] sm:text-[24px] leading-tight tracking-[-0.04em] whitespace-nowrap font-bold text-text-primary">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.ticketMedio)}
          </span>
        </Card>
        <Card className="p-4 flex flex-col gap-1 border-border/60 shadow-sm bg-primary/5 border-primary/20">
          <span className="text-[13px] font-medium text-primary-dark">Valor Aprovado</span>
          <span className="text-[20px] sm:text-[24px] leading-tight tracking-[-0.04em] whitespace-nowrap font-bold text-primary-dark">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.approvedValue)}
          </span>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar cliente ou orçamento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-text-muted shrink-0 mr-1" />
          <select 
            value={periodDays} 
            onChange={e => setPeriodDays(Number(e.target.value))}
            className="bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
          <div className="w-px h-5 bg-border mx-1 hidden lg:block" />
          <Filter className="w-4 h-4 text-text-muted shrink-0 hidden lg:block" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as QuoteStatus | 'all')}
            aria-label="Filtrar orçamentos por status"
            className="lg:hidden min-w-0 max-w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Todos os status</option>
            <option value="draft">Rascunhos</option>
            <option value="sent">Enviados</option>
            <option value="viewed">Visualizados</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Recusados</option>
            <option value="expired">Expirados</option>
          </select>
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'draft', label: 'Rascunhos' },
              { id: 'sent', label: 'Enviados' },
              { id: 'viewed', label: 'Visualizados' },
              { id: 'approved', label: 'Aprovados' },
              { id: 'rejected', label: 'Recusados' },
              { id: 'expired', label: 'Expirados' },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id as QuoteStatus | 'all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors border",
                  statusFilter === filter.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-surface text-text-secondary border-border hover:border-border/80"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-surface-soft rounded-[18px] animate-pulse" />
          ))}
        </div>
      ) : quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center border border-dashed border-border rounded-2xl bg-surface-soft/30">
          <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-5 shadow-sm">
            <FileText className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-[18px] font-bold text-text-primary mb-2">Nenhum orçamento encontrado</h3>
          <p className="text-[15px] text-text-secondary max-w-[340px] mb-8 leading-relaxed">
            {search || statusFilter !== 'all' 
              ? 'Tente alterar os filtros de busca para ver mais resultados.' 
              : 'Você ainda não gerou nenhum orçamento. Clique no botão para começar.'}
          </p>
          {(search || statusFilter !== 'all') ? (
            <button 
              onClick={() => { setSearch(''); setStatusFilter('all'); }}
              className="px-5 py-2.5 rounded-xl font-medium border border-border text-text-secondary hover:bg-surface-soft transition-colors"
            >
              Limpar filtros
            </button>
          ) : (
            <button 
              onClick={() => setLocation('/servicos?action=create')}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button"
            >
              <Plus className="w-[18px] h-[18px]" />
              Criar primeiro orçamento
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-surface border border-border/60 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-soft border-b border-border/60">
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Orçamento</th>
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Cliente</th>
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Data</th>
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Validade</th>
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Valor</th>
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-[13px] font-semibold text-text-secondary uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map(quote => (
                  <tr key={quote.id} className="border-b border-border/40 hover:bg-surface-soft/50 transition-colors group">
                    <td className="px-5 py-4 text-[14px] font-semibold text-text-primary">
                      {quote.number || `#${String(quote.id).padStart(5, '0')}`}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-text-primary font-medium">
                      {quote.clientName}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-text-secondary">
                      {format(parseISO(quote.createdAt), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-text-secondary">
                      {quote.validUntil ? format(parseISO(quote.validUntil), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className="px-5 py-4 text-[14px] font-semibold text-text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[12px] font-medium border",
                        getStatusColor(quote.status)
                      )}>
                        {getStatusLabel(quote.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setLocation(`/orcamentos/${quote.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Detalhes
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {quotes.map(quote => (
              <Card 
                key={quote.id} 
                className="p-4 flex flex-col border-border/60 shadow-sm cursor-pointer hover:border-primary/30 transition-colors active:scale-[0.99]"
                onClick={() => setLocation(`/orcamentos/${quote.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[12px] font-bold text-text-muted tracking-wider block mb-1">
                      {quote.number || `#${String(quote.id).padStart(5, '0')}`}
                    </span>
                    <h4 className="text-[15px] font-bold text-text-primary">{quote.clientName}</h4>
                  </div>
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[11px] font-medium border",
                    getStatusColor(quote.status)
                  )}>
                    {getStatusLabel(quote.status)}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-auto pt-3 border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                    {format(parseISO(quote.createdAt), 'dd/MM/yy')}
                  </div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary ml-auto">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}