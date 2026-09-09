import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ComposedChart, Line
} from 'recharts';
import { 
  Download, Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, 
  Wallet, AlertCircle, Edit2, Trash2, CalendarIcon, CheckCircle2, Circle
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { 
  useListFinancialMovements, 
  useCreateFinancialMovement, 
  useUpdateFinancialMovement, 
  useDeleteFinancialMovement,
  getListFinancialMovementsQueryKey
} from '@workspace/api-client-react';
import type { FinancialMovement } from '@workspace/api-client-react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  type: z.enum(['revenue', 'expense', 'receivable']),
  date: z.string().min(10, 'Data inválida'),
  description: z.string().min(2, 'Descrição deve ter no mínimo 2 caracteres'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  amount: z.coerce.number().min(0.01, 'Valor deve ser maior que zero'),
  status: z.enum(['paid', 'pending']),
  client: z.string().optional().default(''),
  service: z.string().optional().default(''),
  professional: z.string().optional().default(''),
});

type FormValues = z.infer<typeof formSchema>;

export function Financeiro() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedMonth = format(currentDate, 'yyyy-MM');
  const [filterType, setFilterType] = useState<string>('all');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: movements = [], isLoading } = useListFinancialMovements(
    { month: selectedMonth },
    { query: { queryKey: getListFinancialMovementsQueryKey({ month: selectedMonth }) } }
  );

  const createMutation = useCreateFinancialMovement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey({ month: selectedMonth }) });
        toast({ title: 'Movimentação adicionada com sucesso.' });
        setIsFormOpen(false);
      },
      onError: () => {
        toast({ title: 'Erro ao adicionar movimentação.', variant: 'destructive' });
      }
    }
  });

  const updateMutation = useUpdateFinancialMovement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey({ month: selectedMonth }) });
        toast({ title: 'Movimentação atualizada com sucesso.' });
        setIsFormOpen(false);
      },
      onError: () => {
        toast({ title: 'Erro ao atualizar movimentação.', variant: 'destructive' });
      }
    }
  });

  const deleteMutation = useDeleteFinancialMovement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey({ month: selectedMonth }) });
        toast({ title: 'Movimentação excluída com sucesso.' });
        setDeletingId(null);
      },
      onError: () => {
        toast({ title: 'Erro ao excluir movimentação.', variant: 'destructive' });
      }
    }
  });

  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let receivables = 0;

    movements.forEach(m => {
      if (m.type === 'revenue') inflow += m.amount;
      else if (m.type === 'expense') outflow += m.amount;
      
      if (m.status === 'pending' && m.type !== 'expense') {
        receivables += m.amount;
      }
    });

    return {
      inflow,
      outflow,
      net: inflow - outflow,
      receivables
    };
  }, [movements]);

  const chartData = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayMovements = movements.filter(m => m.date.startsWith(dayStr));
      
      let inflow = 0;
      let outflow = 0;
      
      dayMovements.forEach(m => {
        if (m.type === 'revenue') inflow += m.amount;
        if (m.type === 'expense') outflow += m.amount;
      });

      return {
        name: format(day, 'dd/MM'),
        Entradas: inflow,
        Saídas: outflow,
        Lucro: inflow - outflow
      };
    });
  }, [movements, currentDate]);

  const byService = useMemo(() => {
    const map: Record<string, number> = {};
    movements.filter(m => m.type === 'revenue' && m.service).forEach(m => {
      map[m.service!] = (map[m.service!] || 0) + m.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [movements]);

  const byProfessional = useMemo(() => {
    const map: Record<string, number> = {};
    movements.filter(m => m.type === 'revenue' && m.professional).forEach(m => {
      map[m.professional!] = (map[m.professional!] || 0) + m.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [movements]);

  const pendingReceivablesList = useMemo(() => {
    return movements.filter(m => m.status === 'pending' && m.type !== 'expense').sort((a, b) => b.amount - a.amount);
  }, [movements]);

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    movements.filter(m => m.type === 'expense').forEach(m => {
      map[m.category || 'Outros'] = (map[m.category || 'Outros'] || 0) + m.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [movements]);

  const filteredMovements = useMemo(() => {
    let result = movements;
    if (filterType !== 'all') {
      result = result.filter(m => m.type === filterType);
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, filterType]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleExportCSV = () => {
    if (!movements.length) return;
    const bom = '\uFEFF';
    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Cliente', 'Profissional', 'Serviço', 'Status', 'Valor'];
    
    const rows = movements.map(m => [
      format(parseISO(m.date), 'dd/MM/yyyy'),
      m.type === 'revenue' ? 'Receita' : m.type === 'expense' ? 'Despesa' : 'A Receber',
      m.description,
      m.category,
      m.client || '-',
      m.professional || '-',
      m.service || '-',
      m.status === 'paid' ? 'Pago' : 'Pendente',
      m.amount.toString().replace('.', ',')
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `financeiro_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'revenue',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      category: '',
      amount: undefined as unknown as number,
      status: 'paid',
      client: '',
      service: '',
      professional: ''
    }
  });

  const selectedType = form.watch('type');

  useEffect(() => {
    if (isFormOpen) {
      if (editingId) {
        const movement = movements.find(m => m.id === editingId);
        if (movement) {
          form.reset({
            type: movement.type,
            date: movement.date.split('T')[0],
            description: movement.description,
            category: movement.category,
            amount: movement.amount,
            status: movement.status,
            client: movement.client || '',
            service: movement.service || '',
            professional: movement.professional || ''
          });
        }
      } else {
        form.reset({
          type: 'revenue',
          date: format(currentDate, 'yyyy-MM-dd'),
          description: '',
          category: '',
          amount: 0,
          status: 'paid',
          client: '',
          service: '',
          professional: ''
        });
      }
    }
  }, [isFormOpen, editingId, currentDate, form, movements]);

  const onSubmit = (data: FormValues) => {
    const payload = {
      ...data,
      date: data.date + 'T12:00:00Z'
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  };

  const renderProgressBar = (value: number, max: number, colorClass: string) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="h-2 bg-surface-soft rounded-full overflow-hidden mt-1.5">
        <div className={`h-full ${colorClass}`} style={{ width: `${percentage}%` }} />
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-20">
      <PageHeader 
        title="Financeiro"
        description="Acompanhe o faturamento, caixa e rentabilidade do seu SPA."
        action={
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-1 bg-surface border rounded-md p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-text-primary" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="relative">
                <input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => {
                    if(e.target.value) setCurrentDate(parseISO(e.target.value + '-01'));
                  }}
                  className="w-[120px] text-[13px] font-medium text-center bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-text-primary" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2 shadow-sm h-10 w-full sm:w-auto" onClick={handleExportCSV} disabled={!movements.length}>
                <Download className="w-4 h-4" />
                Exportar
              </Button>
              <Button className="gap-2 shadow-button h-10 w-full sm:w-auto" onClick={() => { setEditingId(null); setIsFormOpen(true); }}>
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova movimentação</span>
                <span className="sm:hidden">Nova</span>
              </Button>
            </div>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-surface animate-pulse md:grid-cols-4 md:divide-x md:divide-y-0">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-surface-soft/60" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 divide-y divide-border/80 overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-[0_12px_34px_-28px_rgba(15,23,42,0.35)] sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(n+3)]:border-t lg:grid-cols-4 lg:divide-y-0 lg:[&>*:not(:last-child)]:border-r lg:[&>*:nth-child(n+3)]:border-t-0">
            <div>
              <CardContent className="p-6 md:p-7">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[13px] font-medium text-text-secondary">Faturamento</span>
                  <TrendingUp className="w-[18px] h-[18px] text-text-muted" />
                </div>
                <div className="text-[20px] lg:text-[24px] xl:text-[28px] font-semibold tracking-[-0.04em] text-text-primary whitespace-nowrap truncate">
                  {formatCurrency(summary.inflow)}
                </div>
              </CardContent>
            </div>

            <div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[13px] font-medium text-text-secondary">Despesas</span>
                  <TrendingDown className="w-[18px] h-[18px] text-text-muted" />
                </div>
                <div className="text-[20px] lg:text-[24px] xl:text-[28px] font-semibold tracking-[-0.04em] text-text-primary whitespace-nowrap truncate">
                  {formatCurrency(summary.outflow)}
                </div>
              </CardContent>
            </div>

            <div className="bg-primary-soft/35">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[13px] font-medium text-text-secondary">Lucro</span>
                  <Wallet className="w-[18px] h-[18px] text-primary" />
                </div>
                <div className="text-[20px] lg:text-[24px] xl:text-[28px] font-semibold tracking-[-0.04em] text-text-primary whitespace-nowrap truncate">
                  {formatCurrency(summary.net)}
                </div>
              </CardContent>
            </div>

            <div>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[13px] font-medium text-text-secondary">A receber</span>
                  <AlertCircle className="w-[18px] h-[18px] text-text-muted" />
                </div>
                <div className="text-[20px] lg:text-[24px] xl:text-[28px] font-semibold tracking-[-0.04em] text-text-primary whitespace-nowrap truncate">
                  {formatCurrency(summary.receivables)}
                </div>
              </CardContent>
            </div>
          </div>

          <Card className="shadow-card border-none overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px]">Fluxo financeiro</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="h-[250px] sm:h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(39, 42, 39, 0.06)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} 
                      dy={10}
                      minTickGap={20}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      tickFormatter={(value) => value >= 1000 ? `R$${value/1000}k` : `R$${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-modal)' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Saídas" fill="var(--error)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Line type="monotone" dataKey="Lucro" stroke="var(--accent)" strokeWidth={3} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-card border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-[15px]">Por Serviço</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px] pr-4">
                  {byService.length === 0 ? (
                    <div className="text-[13px] text-text-muted text-center py-10">Nenhuma receita com serviço.</div>
                  ) : (
                    <div className="space-y-4">
                      {byService.slice(0, 10).map((item, i) => (
                        <div key={item.name}>
                          <div className="flex justify-between text-[13px] font-medium text-text-primary">
                            <span className="truncate pr-2">{item.name}</span>
                            <span className="shrink-0">{formatCurrency(item.value)}</span>
                          </div>
                          {renderProgressBar(item.value, byService[0].value, 'bg-primary')}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-card border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-[15px]">Por Profissional</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px] pr-4">
                  {byProfessional.length === 0 ? (
                    <div className="text-[13px] text-text-muted text-center py-10">Nenhuma receita com profissional.</div>
                  ) : (
                    <div className="space-y-4">
                      {byProfessional.slice(0, 10).map((item, i) => (
                        <div key={item.name}>
                          <div className="flex justify-between text-[13px] font-medium text-text-primary">
                            <span className="truncate pr-2">{item.name}</span>
                            <span className="shrink-0">{formatCurrency(item.value)}</span>
                          </div>
                          {renderProgressBar(item.value, byProfessional[0].value, 'bg-accent')}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-card border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-[15px]">Despesas do mês</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px] pr-4">
                  {expensesByCategory.length === 0 ? (
                    <div className="text-[13px] text-text-muted text-center py-10">Nenhuma despesa registrada.</div>
                  ) : (
                    <div className="space-y-4">
                      {expensesByCategory.slice(0, 10).map((item, i) => (
                        <div key={item.name}>
                          <div className="flex justify-between text-[13px] font-medium text-text-primary">
                            <span className="truncate pr-2">{item.name}</span>
                            <span className="shrink-0">{formatCurrency(item.value)}</span>
                          </div>
                          {renderProgressBar(item.value, expensesByCategory[0].value, 'bg-error')}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-card border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-[15px]">Contas a receber</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[220px] pr-4">
                  {pendingReceivablesList.length === 0 ? (
                    <div className="text-[13px] text-text-muted text-center py-10">Tudo em dia!</div>
                  ) : (
                    <div className="space-y-4">
                      {pendingReceivablesList.slice(0, 10).map((m) => (
                        <div key={m.id} className="flex flex-col border-b border-border/50 pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between text-[13px] font-medium text-text-primary">
                            <span className="truncate pr-2">{m.client || m.description}</span>
                            <span className="shrink-0 text-warning">{formatCurrency(m.amount)}</span>
                          </div>
                          <span className="text-[12px] text-text-secondary mt-0.5">{format(parseISO(m.date), 'dd/MM')} • {m.service || m.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-[16px] font-semibold text-text-primary">Movimentações</h2>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-surface-soft p-1 rounded-md w-full sm:w-auto">
                <Button 
                  variant={filterType === 'all' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={`h-8 px-3 text-[13px] flex-1 sm:flex-none ${filterType === 'all' ? 'bg-white shadow-sm' : ''}`}
                  onClick={() => setFilterType('all')}
                >
                  Todas
                </Button>
                <Button 
                  variant={filterType === 'revenue' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={`h-8 px-3 text-[13px] flex-1 sm:flex-none ${filterType === 'revenue' ? 'bg-white shadow-sm text-success' : ''}`}
                  onClick={() => setFilterType('revenue')}
                >
                  Receitas
                </Button>
                <Button 
                  variant={filterType === 'expense' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={`h-8 px-3 text-[13px] flex-1 sm:flex-none ${filterType === 'expense' ? 'bg-white shadow-sm text-error' : ''}`}
                  onClick={() => setFilterType('expense')}
                >
                  Despesas
                </Button>
                <Button 
                  variant={filterType === 'receivable' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className={`h-8 px-3 text-[13px] flex-1 sm:flex-none ${filterType === 'receivable' ? 'bg-white shadow-sm text-warning' : ''}`}
                  onClick={() => setFilterType('receivable')}
                >
                  A receber
                </Button>
              </div>
            </div>

            <Card className="shadow-card border-none overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[800px]">
                  <TableHeader className="bg-surface-soft/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[100px]">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Envolvidos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMovements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-text-secondary text-[14px]">
                          Nenhuma movimentação encontrada neste mês.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMovements.map((m) => (
                        <TableRow key={m.id} className="hover:bg-surface-soft/50 border-border/40">
                          <TableCell className="text-[13px] font-medium text-text-secondary whitespace-nowrap">
                            {format(parseISO(m.date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-[13px] font-medium text-text-primary">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.type === 'revenue' ? 'bg-success' : m.type === 'expense' ? 'bg-error' : 'bg-warning'}`} />
                              {m.description}
                            </div>
                          </TableCell>
                          <TableCell className="text-[13px] text-text-secondary">
                            {m.category}
                          </TableCell>
                          <TableCell className="text-[13px] text-text-secondary">
                            <div className="flex flex-col">
                              {m.client && <span>C: {m.client}</span>}
                              {m.professional && <span className="text-[12px] opacity-70">P: {m.professional}</span>}
                              {m.service && <span className="text-[12px] opacity-70">S: {m.service}</span>}
                              {(!m.client && !m.professional && !m.service) && '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[11px] font-medium border-0 ${m.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                              {m.status === 'paid' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-right text-[14px] font-semibold ${m.type === 'expense' ? 'text-error' : m.type === 'receivable' ? 'text-warning' : 'text-success'}`}>
                            {m.type === 'expense' ? '-' : '+'}{formatCurrency(m.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-primary" onClick={() => { setEditingId(m.id); setIsFormOpen(true); }}>
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-error" onClick={() => setDeletingId(m.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden flex flex-col gap-3 p-4">
                {filteredMovements.length === 0 ? (
                  <div className="text-center text-text-secondary text-[14px] py-8">
                    Nenhuma movimentação encontrada neste mês.
                  </div>
                ) : (
                  filteredMovements.map((m) => (
                    <div key={m.id} className="bg-surface border border-border/40 rounded-[14px] p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-[14px] font-medium text-text-primary">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.type === 'revenue' ? 'bg-success' : m.type === 'expense' ? 'bg-error' : 'bg-warning'}`} />
                            {m.description}
                          </div>
                          <div className="text-[12px] text-text-secondary mt-0.5">
                            {format(parseISO(m.date), 'dd/MM/yyyy')} • {m.category}
                          </div>
                        </div>
                        <div className={`text-right text-[14px] font-semibold shrink-0 ${m.type === 'expense' ? 'text-error' : m.type === 'receivable' ? 'text-warning' : 'text-success'}`}>
                          {m.type === 'expense' ? '-' : '+'}{formatCurrency(m.amount)}
                        </div>
                      </div>
                      
                      {(m.client || m.professional || m.service) && (
                        <div className="text-[12px] text-text-secondary bg-surface-soft p-2 rounded-md">
                          {m.client && <div>Cliente: {m.client}</div>}
                          {m.professional && <div>Profissional: {m.professional}</div>}
                          {m.service && <div>Serviço: {m.service}</div>}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <Badge variant="outline" className={`text-[11px] font-medium border-0 ${m.status === 'paid' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                          {m.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-primary" onClick={() => { setEditingId(m.id); setIsFormOpen(true); }} aria-label="Editar movimentação" title="Editar movimentação">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-error" onClick={() => setDeletingId(m.id)} aria-label="Excluir movimentação" title="Excluir movimentação">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* CREATE/EDIT DIALOG */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-background border-none shadow-modal">
          <DialogHeader className="p-6 bg-surface border-b pb-4">
            <DialogTitle className="text-[18px]">{editingId ? 'Editar Movimentação' : 'Nova Movimentação'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <ScrollArea className="max-h-[70vh]">
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-text-secondary">Tipo</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-surface shadow-sm">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="revenue">Receita</SelectItem>
                              <SelectItem value="expense">Despesa</SelectItem>
                              <SelectItem value="receivable">A Receber</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-text-secondary">Data</FormLabel>
                          <FormControl>
                            <Input type="date" className="bg-surface shadow-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-text-secondary">Descrição</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Pagamento pacote facial" className="bg-surface shadow-sm" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-text-secondary">Categoria</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Estética, Aluguel..." className="bg-surface shadow-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-text-secondary">Valor (R$)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" className="bg-surface shadow-sm" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-text-secondary">Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-surface shadow-sm">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="paid">Pago / Concluído</SelectItem>
                            <SelectItem value="pending">Pendente / Em aberto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedType !== 'expense' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-soft p-4 rounded-[14px] border border-border/50">
                      <FormField
                        control={form.control}
                        name="client"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[12px] text-text-secondary">Cliente</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do cliente" className="h-9 text-[13px] bg-white shadow-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="professional"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[12px] text-text-secondary">Profissional</FormLabel>
                            <FormControl>
                              <Input placeholder="Nome do profissional" className="h-9 text-[13px] bg-white shadow-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="service"
                        render={({ field }) => (
                          <FormItem className="col-span-1 md:col-span-2">
                            <FormLabel className="text-[12px] text-text-secondary">Serviço</FormLabel>
                            <FormControl>
                              <Input placeholder="Qual serviço foi realizado?" className="h-9 text-[13px] bg-white shadow-sm" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-6 bg-surface border-t">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="shadow-button">
                  {editingId ? 'Salvar alterações' : 'Adicionar movimentação'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* DELETE ALERT DIALOG */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="border-none shadow-modal bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              Esta ação não pode ser desfeita. A movimentação será removida permanentemente do histórico do mês.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-soft hover:bg-border/50 border-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deletingId && deleteMutation.mutate({ id: deletingId })}
              className="bg-error hover:bg-error/90 text-white shadow-button"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
