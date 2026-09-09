import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp, Download, PackageOpen, Users, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGetFinanceSummary, useListInventory, useListClients } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays } from 'date-fns';

type ReportType = 'finance' | 'inventory' | 'clients';
type Period = 'all' | '7d' | '30d' | 'custom';

export function Relatorios() {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState<ReportType>('finance');
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [isFinanceRevealed, setIsFinanceRevealed] = useState<boolean>(false);
  
  const { data: financeData, isLoading: loadingFinance } = useGetFinanceSummary();
  const { data: inventoryData = [], isLoading: loadingInventory } = useListInventory();
  const { data: clientsData = [], isLoading: loadingClients } = useListClients();

  const parseBrDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) return d;
      }
    }
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const filterByDate = (dateStr: string | undefined) => {
    if (period === 'all') return true;
    const d = parseBrDate(dateStr);
    if (!d) return false; 
    
    const now = new Date();
    if (period === '7d') {
      return isAfter(d, startOfDay(subDays(now, 7))) && isBefore(d, endOfDay(now));
    }
    if (period === '30d') {
      return isAfter(d, startOfDay(subDays(now, 30))) && isBefore(d, endOfDay(now));
    }
    if (period === 'custom') {
      let isValid = true;
      if (customFrom) {
        const from = parseBrDate(customFrom);
        if (from && isBefore(d, startOfDay(from))) isValid = false;
      }
      if (customTo) {
        const to = parseBrDate(customTo);
        if (to && isAfter(d, endOfDay(to))) isValid = false;
      }
      return isValid;
    }
    return true;
  };

  const filteredInventory = activeReport === 'inventory' ? inventoryData.filter(item => filterByDate(item.nextExpiration)) : [];
  const filteredClients = activeReport === 'clients' ? clientsData.filter(client => filterByDate(client.lastVisit)) : [];

  const getPeriodLabel = () => {
    if (activeReport === 'finance') return 'Visão geral';
    if (period === 'all') return 'Todo o período';
    if (period === '7d') return 'Últimos 7 dias';
    if (period === '30d') return 'Últimos 30 dias';
    if (period === 'custom') {
      const from = parseBrDate(customFrom);
      const to = parseBrDate(customTo);
      if (from && to) return `De ${format(from, 'dd/MM/yyyy')} até ${format(to, 'dd/MM/yyyy')}`;
      if (from) return `A partir de ${format(from, 'dd/MM/yyyy')}`;
      if (to) return `Até ${format(to, 'dd/MM/yyyy')}`;
      return 'Período personalizado';
    }
    return '';
  };

  const handleExportCSV = () => {
    const bom = '\uFEFF';
    let headers: string[] = [];
    let rows: any[][] = [];
    const rangeSuffix = activeReport === 'finance'
      ? 'geral'
      : period === 'custom' && customFrom && customTo
        ? `${customFrom}_a_${customTo}`
        : period;
    let filename = `relatorio_${activeReport}_${rangeSuffix}.csv`;

    if (activeReport === 'finance' && financeData) {
      if (!isFinanceRevealed) {
        toast({
          title: 'Ação necessária',
          description: 'Por favor, exiba os valores do período antes de exportar.',
          variant: 'default'
        });
        return;
      }
      headers = ['Métrica', 'Valor'];
      rows = [
        ['Entradas', financeData.inflow],
        ['Saídas', financeData.outflow],
        ['Saldo Líquido', financeData.net],
        ['Comandas', financeData.openAccounts],
        ['Clientes com uma comanda', financeData.newClients],
        ['Clientes recorrentes', financeData.returningClients]
      ];
    } else if (activeReport === 'inventory' && filteredInventory.length > 0) {
      headers = ['Produto', 'Marca', 'Categoria', 'Estoque', 'Estoque Minimo', 'Status', 'Preço', 'Validade'];
      rows = filteredInventory.map(item => [
        item.name,
        item.brand,
        item.category,
        item.stock,
        item.minimumStock,
        item.status,
        item.price,
        item.nextExpiration || ''
      ]);
    } else if (activeReport === 'clients' && filteredClients.length > 0) {
      headers = ['Nome', 'Status', 'Telefone', 'Origem', 'Última Visita'];
      rows = filteredClients.map(client => [
        client.name,
        client.status,
        client.phone,
        client.source,
        client.lastVisit || ''
      ]);
    } else {
      toast({
        title: 'Nenhum dado disponível',
        description: 'Não há dados para exportar no período selecionado.',
        variant: 'destructive'
      });
      return;
    }

    const csvContent = [
      `Relatório: ${activeReport.toUpperCase()}`,
      `Período: ${getPeriodLabel()}`,
      '',
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: 'Exportação concluída',
      description: 'O relatório foi baixado com sucesso.'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-12">
      <PageHeader 
        title="Relatórios"
        description="Análises avançadas e exportações."
        action={
          <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            activeReport === 'finance' ? "border-primary bg-primary/5 shadow-sm" : "bg-surface"
          )}
          onClick={() => setActiveReport('finance')}
        >
          <div className="p-6 flex flex-col items-center text-center">
            <TrendingUp className={cn("w-6 h-6 mb-3", activeReport === 'finance' ? "text-primary" : "text-text-muted")} />
            <h3 className="text-[14px] font-semibold text-text-primary mb-1">Performance Financeira</h3>
            <p className="text-[12px] text-text-secondary">Visão geral de faturamento.</p>
          </div>
        </Card>
        
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            activeReport === 'inventory' ? "border-primary bg-primary/5 shadow-sm" : "bg-surface"
          )}
          onClick={() => setActiveReport('inventory')}
        >
          <div className="p-6 flex flex-col items-center text-center">
            <PackageOpen className={cn("w-6 h-6 mb-3", activeReport === 'inventory' ? "text-primary" : "text-text-muted")} />
            <h3 className="text-[14px] font-semibold text-text-primary mb-1">Status de Estoque</h3>
            <p className="text-[12px] text-text-secondary">Produtos, insumos e validades.</p>
          </div>
        </Card>

        <Card 
          className={cn(
            "cursor-pointer transition-all hover:border-primary/50",
            activeReport === 'clients' ? "border-primary bg-primary/5 shadow-sm" : "bg-surface"
          )}
          onClick={() => setActiveReport('clients')}
        >
          <div className="p-6 flex flex-col items-center text-center">
            <Users className={cn("w-6 h-6 mb-3", activeReport === 'clients' ? "text-primary" : "text-text-muted")} />
            <h3 className="text-[14px] font-semibold text-text-primary mb-1">Clientes</h3>
            <p className="text-[12px] text-text-secondary">Relação completa de clientes.</p>
          </div>
        </Card>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6 mt-4 min-h-[400px]">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 gap-4 pb-4 border-b border-border">
          <h3 className="text-[16px] font-semibold text-text-primary flex items-center gap-2">
            {activeReport === 'finance' && <><BarChart3 className="w-5 h-5 text-primary" /> Visão geral</>}
            {activeReport === 'inventory' && <><PieChart className="w-5 h-5 text-primary" /> Análise de Estoque</>}
            {activeReport === 'clients' && <><Users className="w-5 h-5 text-primary" /> Relação de Clientes</>}
          </h3>
          
          {activeReport !== 'finance' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-surface-soft p-1 rounded-lg border border-border flex items-center">
                <button 
                  onClick={() => setPeriod('all')}
                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors", period === 'all' ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary")}
                >
                  Todo o período
                </button>
                <button 
                  onClick={() => setPeriod('7d')}
                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors", period === '7d' ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary")}
                >
                  Últimos 7 dias
                </button>
                <button 
                  onClick={() => setPeriod('30d')}
                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors", period === '30d' ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary")}
                >
                  Últimos 30 dias
                </button>
                <button 
                  onClick={() => setPeriod('custom')}
                  className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors", period === 'custom' ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary")}
                >
                  Personalizado
                </button>
              </div>
              
              {period === 'custom' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input 
                      type="date" 
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      className="text-[12px] bg-background border border-border rounded-md pl-8 pr-2 py-1.5 h-8 w-[130px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <CalendarIcon className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <span className="text-text-secondary text-[12px]">até</span>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      className="text-[12px] bg-background border border-border rounded-md pl-8 pr-2 py-1.5 h-8 w-[130px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <CalendarIcon className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {activeReport === 'finance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div className="text-[13px] text-text-secondary">
                Exibindo os valores gerais do caixa.
              </div>
              {isFinanceRevealed && (
                <Button variant="ghost" size="sm" onClick={() => setIsFinanceRevealed(false)} className="text-text-secondary h-8">
                  Ocultar valores
                </Button>
              )}
            </div>
            
            {!isFinanceRevealed ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-surface-soft/50 rounded-xl border border-dashed border-border">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h4 className="text-[15px] font-medium text-text-primary mb-2">Relatório Financeiro Oculto</h4>
                <p className="text-[14px] text-text-secondary max-w-md mb-6">
                  Os valores financeiros contemplam <strong>Todo o período</strong>. Exiba os dados apenas quando for seguro visualizá-los.
                </p>
                <Button onClick={() => setIsFinanceRevealed(true)} className="bg-primary hover:bg-primary-dark text-white rounded-lg px-6">
                  Exibir todo o período
                </Button>
              </div>
            ) : loadingFinance ? (
               <div className="h-40 bg-surface-soft animate-pulse rounded-xl" />
            ) : financeData ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-5 bg-background rounded-xl border border-border shadow-sm">
                  <div className="text-[13px] font-medium text-text-secondary mb-2">Entradas</div>
                  <div className="text-[24px] font-semibold tracking-tight text-success">{formatCurrency(financeData.inflow)}</div>
                </div>
                <div className="p-5 bg-background rounded-xl border border-border shadow-sm">
                  <div className="text-[13px] font-medium text-text-secondary mb-2">Saídas</div>
                  <div className="text-[24px] font-semibold tracking-tight text-error">{formatCurrency(financeData.outflow)}</div>
                </div>
                <div className="p-5 bg-background rounded-xl border border-border shadow-sm ring-1 ring-primary/10">
                  <div className="text-[13px] font-medium text-text-secondary mb-2">Saldo Líquido</div>
                  <div className="text-[24px] font-semibold tracking-tight text-text-primary">{formatCurrency(financeData.net)}</div>
                </div>
                <div className="p-5 bg-background rounded-xl border border-border shadow-sm">
                  <div className="text-[13px] font-medium text-text-secondary mb-2">Comandas</div>
                  <div className="text-[24px] font-semibold tracking-tight text-text-primary">{financeData.openAccounts}</div>
                </div>
                <div className="p-5 bg-background rounded-xl border border-border shadow-sm">
                  <div className="text-[13px] font-medium text-text-secondary mb-2">Clientes com uma comanda</div>
                  <div className="text-[24px] font-semibold tracking-tight text-text-primary">{financeData.newClients}</div>
                </div>
                <div className="p-5 bg-background rounded-xl border border-border shadow-sm">
                  <div className="text-[13px] font-medium text-text-secondary mb-2">Clientes recorrentes</div>
                  <div className="text-[24px] font-semibold tracking-tight text-text-primary">{financeData.returningClients}</div>
                </div>
              </div>
            ) : (
              <div className="text-[14px] text-text-muted text-center py-12">Nenhum dado financeiro disponível.</div>
            )}
          </div>
        )}

        {activeReport === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] text-text-secondary">
                Exibindo <span className="font-semibold text-text-primary">{filteredInventory.length}</span> registro(s) • <span className="font-medium">{getPeriodLabel()}</span>
              </div>
            </div>
            {loadingInventory ? (
              <div className="h-40 bg-surface-soft animate-pulse rounded-xl" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface-soft border-b border-border text-text-secondary">
                      <th className="py-3 px-4 font-medium">Produto</th>
                      <th className="py-3 px-4 font-medium">Categoria</th>
                      <th className="py-3 px-4 font-medium text-right">Estoque</th>
                      <th className="py-3 px-4 font-medium text-right">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Validade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {filteredInventory.map(item => (
                      <tr key={item.id} className="hover:bg-surface-soft/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-text-primary">{item.name}</td>
                        <td className="py-3 px-4 text-text-secondary">{item.category}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn(
                            "inline-flex items-center justify-center min-w-[2rem]",
                            item.stock <= item.minimumStock ? 'text-error font-semibold' : 'text-text-primary font-medium'
                          )}>
                            {item.stock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-text-secondary capitalize">{item.status}</td>
                        <td className="py-3 px-4 text-right text-text-secondary">{item.nextExpiration || '-'}</td>
                      </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                      <tr><td colSpan={5} className="py-12 text-center text-text-muted bg-background">Nenhum produto encontrado neste período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeReport === 'clients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] text-text-secondary">
                Exibindo <span className="font-semibold text-text-primary">{filteredClients.length}</span> registro(s) • <span className="font-medium">{getPeriodLabel()}</span>
              </div>
            </div>
            {loadingClients ? (
              <div className="h-40 bg-surface-soft animate-pulse rounded-xl" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-surface-soft border-b border-border text-text-secondary">
                      <th className="py-3 px-4 font-medium">Nome</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Origem</th>
                      <th className="py-3 px-4 font-medium text-right">Última Visita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-background">
                    {filteredClients.map(client => (
                      <tr key={client.id} className="hover:bg-surface-soft/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-text-primary">{client.name}</td>
                        <td className="py-3 px-4 text-text-secondary capitalize">{client.status.replace('_', ' ')}</td>
                        <td className="py-3 px-4 text-text-secondary">{client.source}</td>
                        <td className="py-3 px-4 text-right text-text-secondary font-medium">{client.lastVisit || '-'}</td>
                      </tr>
                    ))}
                    {filteredClients.length === 0 && (
                      <tr><td colSpan={4} className="py-12 text-center text-text-muted bg-background">Nenhum cliente encontrado neste período.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
