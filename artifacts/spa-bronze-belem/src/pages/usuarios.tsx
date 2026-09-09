import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListProfessionals,
  useCreateProfessional,
  useUpdateProfessional,
  useDeleteProfessional,
  getListProfessionalsQueryKey,
  useListAppointments,
  useListServices,
  Professional,
  Appointment
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus, Users, BadgeDollarSign, Edit, Trash2, CalendarIcon, Download, Search, AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { format, isAfter, isBefore, startOfDay, endOfDay, subDays } from 'date-fns';

function parseBrPrice(priceStr: string | undefined): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  const noDots = cleaned.replace(/\./g, '');
  const withDot = noDots.replace(',', '.');
  const parsed = parseFloat(withDot);
  return isNaN(parsed) ? null : parsed;
}

function parseSafeDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  
  if (/^\d{2}:\d{2}$/.test(dateStr)) {
    const [h, m] = dateStr.split(':');
    const d = new Date();
    d.setHours(+h, +m, 0, 0);
    return d;
  }
  
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  return null;
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

type Tab = 'profissionais' | 'comissoes';
type Period = 'today' | '7d' | '30d' | 'all' | 'custom';

export function Usuarios() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<Tab>('profissionais');
  
  const { data: professionals = [], isLoading: loadingProf } = useListProfessionals();
  const { data: appointments = [], isLoading: loadingAppt } = useListAppointments();
  const { data: services = [], isLoading: loadingSvc } = useListServices();
  
  const createProf = useCreateProfessional();
  const updateProf = useUpdateProfessional();
  const deleteProf = useDeleteProfessional();
  
  const [profDialog, setProfDialog] = useState<{ open: boolean, prof: Professional | null }>({ open: false, prof: null });
  const [formData, setFormData] = useState({ name: '', specialty: '', phone: '', email: '', commissionRate: 0, active: true });
  const [errors, setErrors] = useState<{ name?: string }>({});
  
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, id: number | null }>({ open: false, id: null });
  
  const [period, setPeriod] = useState<Period>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const openProfDialog = (prof?: Professional) => {
    if (prof) {
      setFormData({ 
        name: prof.name, 
        specialty: prof.specialty, 
        phone: prof.phone, 
        email: prof.email, 
        commissionRate: prof.commissionRate, 
        active: prof.active 
      });
      setProfDialog({ open: true, prof });
    } else {
      setFormData({ name: '', specialty: '', phone: '', email: '', commissionRate: 0, active: true });
      setProfDialog({ open: true, prof: null });
    }
    setErrors({});
  };

  const handleSaveProf = () => {
    if (!formData.name.trim()) {
      setErrors({ name: 'Nome é obrigatório' });
      return;
    }
    
    const payload = {
      name: formData.name,
      specialty: formData.specialty,
      phone: formData.phone,
      email: formData.email,
      commissionRate: Number(formData.commissionRate),
      active: formData.active
    };

    if (profDialog.prof) {
      updateProf.mutate({ id: profDialog.prof.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
          setProfDialog({ open: false, prof: null });
          toast({ title: 'Profissional atualizado' });
        }
      });
    } else {
      createProf.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
          setProfDialog({ open: false, prof: null });
          toast({ title: 'Profissional criado' });
        }
      });
    }
  };

  const handleDeleteProf = () => {
    if (deleteConfirm.id) {
      deleteProf.mutate({ id: deleteConfirm.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
          setDeleteConfirm({ open: false, id: null });
          toast({ title: 'Profissional removido' });
        }
      });
    }
  };
  
  const filteredCommissions = useMemo(() => {
    const now = new Date();
    
    return appointments.filter((appt: Appointment) => {
      if (appt.status !== 'completed') return false;
      
      const d = parseSafeDate(appt.start);
      if (!d) return false;
      
      if (period === 'today') {
        return isAfter(d, startOfDay(now)) && isBefore(d, endOfDay(now));
      } else if (period === '7d') {
        return isAfter(d, startOfDay(subDays(now, 7))) && isBefore(d, endOfDay(now));
      } else if (period === '30d') {
        return isAfter(d, startOfDay(subDays(now, 30))) && isBefore(d, endOfDay(now));
      } else if (period === 'custom') {
        let valid = true;
        if (customFrom) {
          const fromD = new Date(customFrom);
          if (!isNaN(fromD.getTime()) && isBefore(d, startOfDay(fromD))) valid = false;
        }
        if (customTo) {
          const toD = new Date(customTo);
          if (!isNaN(toD.getTime()) && isAfter(d, endOfDay(toD))) valid = false;
        }
        return valid;
      }
      return true; // all
    }).map(appt => {
      const prof = professionals.find(p => p.name.toLowerCase() === appt.professional.toLowerCase());
      const svc = services.find(s => s.name.toLowerCase() === appt.service.toLowerCase());
      
      const price = svc ? parseBrPrice(svc.price) : null;
      const rate = prof ? prof.commissionRate : 0;
      const commission = price !== null ? (price * rate) / 100 : null;
      
      return {
        ...appt,
        dateObj: parseSafeDate(appt.start),
        profObj: prof,
        svcObj: svc,
        price,
        rate,
        commission
      };
    }).sort((a, b) => (b.dateObj?.getTime() ?? 0) - (a.dateObj?.getTime() ?? 0));
  }, [appointments, professionals, services, period, customFrom, customTo]);

  const commissionStats = useMemo(() => {
    let apptsCount = 0;
    let totalValue = 0;
    let totalCommissions = 0;
    const profsSet = new Set<string>();
    
    filteredCommissions.forEach(c => {
      apptsCount++;
      if (c.price !== null) totalValue += c.price;
      if (c.commission !== null) totalCommissions += c.commission;
      if (c.profObj) profsSet.add(c.profObj.id.toString());
    });
    
    return { apptsCount, totalValue, totalCommissions, activeProfs: profsSet.size };
  }, [filteredCommissions]);
  
  const statsByProf = useMemo(() => {
    const stats: Record<string, { prof: Professional, count: number, value: number, commission: number }> = {};
    
    filteredCommissions.forEach(c => {
      if (c.profObj) {
        if (!stats[c.profObj.id]) {
          stats[c.profObj.id] = { prof: c.profObj, count: 0, value: 0, commission: 0 };
        }
        stats[c.profObj.id].count++;
        if (c.price !== null) stats[c.profObj.id].value += c.price;
        if (c.commission !== null) stats[c.profObj.id].commission += c.commission;
      }
    });
    
    return Object.values(stats).sort((a, b) => b.commission - a.commission);
  }, [filteredCommissions]);

  const handleExportCSV = () => {
    if (filteredCommissions.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Não há registros calculáveis neste período.',
        variant: 'destructive'
      });
      return;
    }
    
    const bom = '\uFEFF';
    const headers = ['Data', 'Profissional', 'Cliente', 'Serviço', 'Valor Base', 'Taxa (%)', 'Comissão', 'Status'];
    
    const rows = filteredCommissions.map(c => {
      const dateStr = c.dateObj ? format(c.dateObj, 'dd/MM/yyyy HH:mm') : c.start;
      const baseStr = c.price !== null ? formatCurrency(c.price) : 'Preço não encontrado';
      const commStr = c.commission !== null ? formatCurrency(c.commission) : '-';
      const rateStr = c.rate + '%';
      
      return [
        dateStr,
        c.professional,
        c.client,
        c.service,
        baseStr,
        rateStr,
        commStr,
        c.price !== null ? 'OK' : 'Erro de preço'
      ];
    });
    
    const csvContent = [
      `Relatório de Comissões`,
      `Período: ${period}`,
      '',
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `comissoes_${period}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: 'Exportação concluída' });
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-12">
      <PageHeader 
        title="Usuários"
        description="Profissionais, comissões e desempenho por período."
        action={
          activeTab === 'profissionais' ? (
            <Button className="bg-primary hover:bg-primary-dark text-white shadow-none rounded-lg" onClick={() => openProfDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Profissional
            </Button>
          ) : (
            <Button variant="outline" className="gap-2" onClick={handleExportCSV} disabled={filteredCommissions.length === 0}>
              <Download className="w-4 h-4" />
              Exportar Comissões
            </Button>
          )
        }
      />
      
      <div className="flex border-b border-border mb-6">
        <button
          className={cn("px-6 py-3 text-[14px] font-medium transition-colors border-b-2", activeTab === 'profissionais' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
          onClick={() => setActiveTab('profissionais')}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Profissionais
          </div>
        </button>
        <button
          className={cn("px-6 py-3 text-[14px] font-medium transition-colors border-b-2", activeTab === 'comissoes' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
          onClick={() => setActiveTab('comissoes')}
        >
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4" /> Comissões
          </div>
        </button>
      </div>

      {activeTab === 'profissionais' && (
        <div className="space-y-4">
          {loadingProf ? (
            <div className="h-64 bg-surface-soft animate-pulse rounded-xl" />
          ) : professionals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-xl border border-border">
              <Users className="w-10 h-10 text-text-muted mb-4" />
              <h3 className="text-[15px] font-medium text-text-primary mb-1">Nenhum profissional cadastrado</h3>
              <p className="text-[14px] text-text-secondary mb-4">Adicione profissionais para gerenciar agenda e comissões.</p>
              <Button onClick={() => openProfDialog()} variant="outline">Cadastrar profissional</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {professionals.map(prof => (
                <Card key={prof.id} className="p-5 bg-surface border-border shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-text-primary text-[16px]">{prof.name}</h4>
                        <p className="text-[13px] text-text-secondary">{prof.specialty || 'Sem especialidade'}</p>
                      </div>
                      <div className={cn("px-2 py-0.5 rounded-[4px] text-[11px] font-bold uppercase", prof.active ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted")}>
                        {prof.active ? 'Ativo' : 'Inativo'}
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 mb-4">
                      {prof.phone && <div className="text-[13px] text-text-secondary">{prof.phone}</div>}
                      {prof.email && <div className="text-[13px] text-text-secondary">{prof.email}</div>}
                      <div className="text-[13px] font-medium text-text-primary mt-2">
                        Comissão: {prof.commissionRate}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-4 border-t border-border mt-auto">
                    <Button variant="ghost" size="sm" className="flex-1 text-[13px] h-8" onClick={() => openProfDialog(prof)}>
                      <Edit className="w-3.5 h-3.5 mr-2" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="flex-1 text-[13px] h-8 text-error hover:bg-error/10 hover:text-error" onClick={() => setDeleteConfirm({ open: true, id: prof.id })}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Remover
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'comissoes' && (
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BadgeDollarSign className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-text-primary">Filtro de Período</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-surface-soft p-1 rounded-lg border border-border flex items-center">
                  {(['today', '7d', '30d', 'all', 'custom'] as const).map(p => (
                    <button 
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={cn("px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors", period === p ? "bg-background text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary")}
                    >
                      {p === 'today' && 'Hoje'}
                      {p === '7d' && '7 dias'}
                      {p === '30d' && '30 dias'}
                      {p === 'all' && 'Todo o período'}
                      {p === 'custom' && 'Personalizado'}
                    </button>
                  ))}
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
            </div>
            
            {period === 'custom' && customFrom && customTo && new Date(customFrom) > new Date(customTo) && (
              <div className="mt-3 text-error text-[12px] flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> A data inicial deve ser anterior à data final.
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-background shadow-sm border-border">
              <div className="text-[13px] text-text-secondary mb-1">Atendimentos Concluídos</div>
              <div className="text-[24px] font-semibold text-text-primary">{commissionStats.apptsCount}</div>
            </Card>
            <Card className="p-5 bg-background shadow-sm border-border">
              <div className="text-[13px] text-text-secondary mb-1">Valor dos Serviços</div>
              <div className="text-[24px] font-semibold text-text-primary">{formatCurrency(commissionStats.totalValue)}</div>
            </Card>
            <Card className="p-5 bg-primary/10 shadow-sm border-primary/20">
              <div className="text-[13px] text-primary-dark font-medium mb-1">Comissões a Pagar</div>
              <div className="text-[24px] font-semibold text-primary-dark">{formatCurrency(commissionStats.totalCommissions)}</div>
            </Card>
            <Card className="p-5 bg-background shadow-sm border-border">
              <div className="text-[13px] text-text-secondary mb-1">Profissionais com Movimento</div>
              <div className="text-[24px] font-semibold text-text-primary">{commissionStats.activeProfs}</div>
            </Card>
          </div>
          
          {loadingAppt || loadingSvc ? (
            <div className="h-64 bg-surface-soft animate-pulse rounded-xl" />
          ) : filteredCommissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-surface rounded-xl border border-border">
              <Search className="w-10 h-10 text-text-muted mb-4" />
              <h3 className="text-[15px] font-medium text-text-primary mb-1">Nenhum atendimento para comissão</h3>
              <p className="text-[14px] text-text-secondary max-w-md text-center">
                Comissões só aparecem para agendamentos marcados como <strong>Concluído</strong> no período selecionado.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-surface-soft/50">
                  <h4 className="font-semibold text-text-primary text-[15px]">Desempenho por Profissional</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-surface border-b border-border text-text-secondary">
                        <th className="py-3 px-4 font-medium">Profissional</th>
                        <th className="py-3 px-4 font-medium text-right">Atendimentos</th>
                        <th className="py-3 px-4 font-medium text-right">Base de Cálculo</th>
                        <th className="py-3 px-4 font-medium text-right">Comissão Devida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {statsByProf.map(stat => (
                        <tr key={stat.prof.id} className="hover:bg-surface-soft/50">
                          <td className="py-3 px-4 font-medium text-text-primary">
                            {stat.prof.name} <span className="text-text-muted font-normal">({stat.prof.commissionRate}%)</span>
                          </td>
                          <td className="py-3 px-4 text-right">{stat.count}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(stat.value)}</td>
                          <td className="py-3 px-4 text-right font-medium text-text-primary">{formatCurrency(stat.commission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border bg-surface-soft/50">
                  <h4 className="font-semibold text-text-primary text-[15px]">Detalhamento de Atendimentos</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-surface border-b border-border text-text-secondary">
                        <th className="py-3 px-4 font-medium">Data</th>
                        <th className="py-3 px-4 font-medium">Cliente</th>
                        <th className="py-3 px-4 font-medium">Serviço</th>
                        <th className="py-3 px-4 font-medium">Profissional</th>
                        <th className="py-3 px-4 font-medium text-right">Base</th>
                        <th className="py-3 px-4 font-medium text-right">Taxa</th>
                        <th className="py-3 px-4 font-medium text-right">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredCommissions.map(c => (
                        <tr key={c.id} className="hover:bg-surface-soft/50">
                          <td className="py-3 px-4 text-text-secondary">
                            {c.dateObj ? format(c.dateObj, "dd/MM 'às' HH:mm") : c.start}
                          </td>
                          <td className="py-3 px-4 font-medium text-text-primary">{c.client}</td>
                          <td className="py-3 px-4 text-text-secondary">{c.service}</td>
                          <td className="py-3 px-4 text-text-secondary">{c.professional}</td>
                          <td className="py-3 px-4 text-right">
                            {c.price !== null ? (
                              formatCurrency(c.price)
                            ) : (
                              <span className="text-warning text-[12px] flex items-center justify-end gap-1">
                                <AlertCircle className="w-3 h-3" /> Preço não encontrado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-text-secondary">{c.rate}%</td>
                          <td className="py-3 px-4 text-right font-medium text-text-primary">
                            {c.commission !== null ? formatCurrency(c.commission) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={profDialog.open} onOpenChange={o => !o && setProfDialog({ open: false, prof: null })}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle>{profDialog.prof ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-text-primary">Nome</label>
              <input 
                className={cn("w-full h-10 px-3 text-[14px] bg-background border rounded-lg focus:outline-none focus:ring-1", errors.name ? "border-error focus:ring-error" : "border-border focus:ring-primary")}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Ana Silva"
              />
              {errors.name && <span className="text-error text-[12px]">{errors.name}</span>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-text-primary">Especialidade</label>
                <input 
                  className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.specialty}
                  onChange={e => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="Ex: Massoterapeuta"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-text-primary">Comissão (%)</label>
                <input 
                  type="number"
                  min="0" max="100"
                  className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.commissionRate}
                  onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-text-primary">Telefone</label>
                <input 
                  className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[13px] font-medium text-text-primary">Email</label>
                <input 
                  type="email"
                  className="w-full h-10 px-3 text-[14px] bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <button 
                type="button"
                className={cn("w-10 h-6 rounded-full transition-colors relative", formData.active ? "bg-primary" : "bg-border")}
                onClick={() => setFormData({ ...formData, active: !formData.active })}
              >
                <div className={cn("w-4 h-4 rounded-full bg-white absolute top-1 transition-transform", formData.active ? "left-5" : "left-1")} />
              </button>
              <span className="text-[13px] font-medium text-text-primary">Profissional Ativo</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfDialog({ open: false, prof: null })}>Cancelar</Button>
            <Button onClick={handleSaveProf} className="bg-primary hover:bg-primary-dark text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm.open} onOpenChange={o => !o && setDeleteConfirm({ open: false, id: null })}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O profissional não aparecerá mais nas listas e agendamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProf} className="bg-error hover:bg-error/90 text-white">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}