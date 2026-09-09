import React, { useState, useMemo } from 'react';
import { 
  useListAppointments, 
  useListQuotes, 
  useListLeads,
  useListClients
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { 
  Plus, Clock, MapPin, User, ChevronRight, ChevronLeft, 
  Calendar as CalendarIcon, Minus, TrendingUp, TrendingDown,
  FileText, Users, Activity, Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  format, addDays, subDays, isToday, parseISO, 
  startOfDay, endOfDay, isWithinInterval, differenceInDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'wouter';

function parseSafeDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
    const [d, m, y] = dateStr.split(' ')[0].split('/');
    const date = new Date(+y, +m - 1, +d);
    if (!isNaN(date.getTime())) return date;
  }
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  return null;
}

function getTrend(current: number, previous: number) {
  if (previous === 0) {
    if (current > 0) return { trend: 'up', text: '+100%' };
    return { trend: 'neutral', text: '0%' };
  }
  
  const diff = current - previous;
  if (diff === 0) return { trend: 'neutral', text: '0%' };
  
  const percent = Math.round((Math.abs(diff) / previous) * 100);
  const trend = diff > 0 ? 'up' : 'down';
  return { trend, text: `${diff > 0 ? '+' : '-'}${percent}%` };
}

function MetricTrend({ trend, change }: { trend: string; change: string }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
        <TrendingUp className="w-3.5 h-3.5" strokeWidth={3} />
        {change}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-error bg-error/10 px-2 py-0.5 rounded-full">
        <TrendingDown className="w-3.5 h-3.5" strokeWidth={3} />
        {change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-text-secondary bg-surface-soft px-2 py-0.5 rounded-full">
      <Minus className="w-3.5 h-3.5" strokeWidth={3} />
      {change}
    </span>
  );
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

function MetricCard({ 
  title, icon: Icon, current, prev, subLabel1, subValue1, subLabel2, subValue2, isCurrency, highlight = false, invalid = false
}: { 
  title: string; icon: React.ElementType; current: number; prev: number; subLabel1?: string; subValue1?: number | string; subLabel2?: string; subValue2?: number | string; isCurrency?: boolean; highlight?: boolean; invalid?: boolean
}) {
  const trend = invalid ? { trend: 'neutral', text: '-' } : getTrend(current, prev);
  const displayValue = isCurrency ? formatCurrency(current) : current;
  
  return (
    <div className={cn(
      "p-6 md:p-8 rounded-lg border flex flex-col gap-6 transition-all hover:-translate-y-1 bg-surface relative overflow-hidden group shadow-card",
      highlight ? "border-primary/30 ring-1 ring-primary/10" : "border-border hover:shadow-md",
    )}>
      {highlight && <div className="absolute top-0 left-0 w-full h-1 bg-primary" />}
      {!highlight && <div className="absolute top-0 left-0 w-full h-1 bg-primary/20 group-hover:bg-primary transition-colors" />}
      
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-text-secondary flex items-center gap-2.5">
          <Icon className={cn("w-[18px] h-[18px]", highlight ? "text-primary" : "text-text-muted group-hover:text-primary")} strokeWidth={1.8} />
          {title}
        </span>
        <MetricTrend trend={trend.trend} change={trend.text} />
      </div>

      <div>
        <span className={cn("text-[36px] font-extrabold tracking-tight leading-none", invalid ? "text-text-muted" : "text-dark")}>
          {invalid ? '-' : displayValue}
        </span>
      </div>

      {(subLabel1 || subLabel2) && !invalid && (
        <div className="flex items-center gap-6 pt-6 border-t border-border mt-auto">
          {subLabel1 && (
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-text-muted mb-1">{subLabel1}</span>
              <span className="text-[14px] font-bold text-text-primary">{subValue1}</span>
            </div>
          )}
          {subLabel2 && (
            <div className="flex flex-col border-l border-border pl-6">
              <span className="text-[11px] font-medium text-text-muted mb-1">{subLabel2}</span>
              <span className="text-[14px] font-bold text-text-primary">{subValue2}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

export function Dashboard() {
  const [_, setLocation] = useLocation();
  
  const now = useMemo(() => new Date(), []);
  
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'custom'>('today');
  const [customRange, setCustomRange] = useState<{from: Date, to: Date} | null>(null);
  
  const [agendaDate, setAgendaDate] = useState<Date>(new Date());

  const { data: allAppointments = [], isLoading: isAppointmentsLoading } = useListAppointments();
  const { data: allQuotes = [], isLoading: isQuotesLoading } = useListQuotes();
  const { data: allLeads = [], isLoading: isLeadsLoading } = useListLeads();
  const { data: allClients = [], isLoading: isClientsLoading } = useListClients();

  const isLoading = isAppointmentsLoading || isQuotesLoading || isLeadsLoading || isClientsLoading;

  const { from, to, prevFrom, prevTo, isValid } = useMemo(() => {
    let f: Date, t: Date;
    let isValid = true;
    if (period === 'today') {
      f = startOfDay(now);
      t = endOfDay(now);
    } else if (period === '7d') {
      f = startOfDay(subDays(now, 6));
      t = endOfDay(now);
    } else if (period === '30d') {
      f = startOfDay(subDays(now, 29));
      t = endOfDay(now);
    } else if (period === 'custom' && customRange) {
      f = startOfDay(customRange.from);
      t = endOfDay(customRange.to);
      if (customRange.from > customRange.to) {
        isValid = false;
      }
    } else {
      f = startOfDay(now);
      t = endOfDay(now);
    }
    
    if (!isValid) {
      return { from: now, to: now, prevFrom: now, prevTo: now, isValid: false };
    }
    
    const length = differenceInDays(t, f) + 1;
    const pF = startOfDay(subDays(f, length));
    const pT = endOfDay(subDays(f, 1));
    
    return { from: f, to: t, prevFrom: pF, prevTo: pT, isValid };
  }, [period, customRange, now]);

  const metrics = useMemo(() => {
    if (!isValid) {
      return {
        agendamentos: { current: 0, prev: 0, completed: 0, cancelled: 0 },
        clientes: { current: 0, prev: 0, newClients: 0 },
        orcamentos: { current: 0, prev: 0, approved: 0, approvedVal: 0 },
        valorOrcamentos: { current: 0, prev: 0 },
      };
    }

    let apptsCurrent = 0, apptsPrev = 0, apptsCompleted = 0, apptsCancelled = 0;
    
    allAppointments.forEach(a => {
      let d: Date;
      if (!a.start.includes('T')) {
        const [h, m] = a.start.split(':').map(Number);
        d = new Date(now);
        d.setHours(h || 0, m || 0, 0, 0);
      } else {
        d = new Date(a.start);
      }
      
      if (isWithinInterval(d, { start: from, end: to })) {
        apptsCurrent++;
        if (a.status === 'completed') apptsCompleted++;
        if (a.status === 'cancelled') apptsCancelled++;
      } else if (isWithinInterval(d, { start: prevFrom, end: prevTo })) {
        apptsPrev++;
      }
    });

    let clientsCurrent = 0, clientsPrev = 0, clientsNew = 0;
    
    allClients.forEach(c => {
      const d = parseSafeDate(c.lastVisit);
      if (!d) return;
      if (isWithinInterval(d, { start: from, end: to })) {
        clientsCurrent++;
        if (c.status === 'new') clientsNew++;
      } else if (isWithinInterval(d, { start: prevFrom, end: prevTo })) {
        clientsPrev++;
      }
    });

    let quotesCurrent = 0, quotesPrev = 0, quotesValCurrent = 0, quotesValPrev = 0;
    let quotesApproved = 0, quotesApprovedVal = 0;
    
    allQuotes.forEach(q => {
      const d = new Date(q.createdAt);
      if (isWithinInterval(d, { start: from, end: to })) {
        quotesCurrent++;
        quotesValCurrent += q.total;
        if (q.status === 'approved') {
          quotesApproved++;
          quotesApprovedVal += q.total;
        }
      } else if (isWithinInterval(d, { start: prevFrom, end: prevTo })) {
        quotesPrev++;
        quotesValPrev += q.total;
      }
    });
    
    return {
      agendamentos: { current: apptsCurrent, prev: apptsPrev, completed: apptsCompleted, cancelled: apptsCancelled },
      clientes: { current: clientsCurrent, prev: clientsPrev, newClients: clientsNew },
      orcamentos: { current: quotesCurrent, prev: quotesPrev, approved: quotesApproved, approvedVal: quotesApprovedVal },
      valorOrcamentos: { current: quotesValCurrent, prev: quotesValPrev },
    };
  }, [allAppointments, allQuotes, allClients, from, to, prevFrom, prevTo, isValid, now]);

  const leadsNew = allLeads.filter(l => l.stage === 'new' || l.stage === 'contacting');
  const leadsQuote = allLeads.filter(l => l.stage === 'quote');
  const urgentLeads = allLeads
    .filter(l => l.stage !== 'converted' && l.stage !== 'lost')
    .slice(0, 4);

  const inProgressAppts = allAppointments.filter(a => a.status === 'in_progress');

  const agendaAppts = allAppointments.filter(a => {
    let d: Date;
    if (!a.start.includes('T')) {
      d = new Date(now);
    } else {
      d = new Date(a.start);
    }
    return d.getFullYear() === agendaDate.getFullYear() && 
           d.getMonth() === agendaDate.getMonth() && 
           d.getDate() === agendaDate.getDate();
  }).sort((a, b) => {
    const timeA = !a.start.includes('T') ? (() => { const d = new Date(now); const [h,m] = a.start.split(':'); d.setHours(+h, +m); return d.getTime(); })() : new Date(a.start).getTime();
    const timeB = !b.start.includes('T') ? (() => { const d = new Date(now); const [h,m] = b.start.split(':'); d.setHours(+h, +m); return d.getTime(); })() : new Date(b.start).getTime();
    return timeA - timeB;
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8 max-w-[1400px] mx-auto pb-12">
        <div className="h-16 w-1/3 bg-surface-soft rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[240px] bg-surface-soft rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 h-[500px] bg-surface-soft rounded-lg" />
          <div className="lg:col-span-4 h-[500px] bg-surface-soft rounded-lg" />
          <div className="lg:col-span-4 h-[500px] bg-surface-soft rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-[1400px] mx-auto pb-16 relative">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/60">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-bold tracking-tight text-dark leading-[1.08]">
            {getGreeting()}, <span className="text-primary whitespace-nowrap">Wagner.</span>
          </h1>
          <p className="text-text-secondary mt-2 text-[15px] font-medium">
            Aqui está o resumo das suas operações de bem-estar de hoje.
          </p>
        </div>
        
        <Button 
          size="lg"
          onClick={() => setLocation('/agenda?novo=1')}
        >
          <Plus className="w-5 h-5 mr-2" strokeWidth={2.5} />
          Novo agendamento
        </Button>
      </header>

      <section>
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {(['today', '7d', '30d', 'custom'] as const).map(p => (
            <button 
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-5 py-2.5 rounded-full text-[12px] font-semibold transition-all border outline-none focus-visible:ring-2 ring-primary/50", 
                period === p 
                  ? 'bg-primary text-white border-primary shadow-button' 
                  : 'bg-surface text-text-secondary border-border hover:border-primary/30 hover:text-dark hover:bg-primary-soft/50'
              )}
            >
              {p === 'today' && 'Hoje'}
              {p === '7d' && '7 dias'}
              {p === '30d' && '30 dias'}
              {p === 'custom' && 'Personalizado'}
            </button>
          ))}
          
          {period === 'custom' && (
            <div className="flex flex-col gap-1 ml-2 animate-in fade-in slide-in-from-left-4">
              <div className="flex items-center gap-2 bg-surface rounded-full px-2 py-1.5 border border-border shadow-sm">
                <input 
                  type="date"
                  className="bg-transparent border-none text-[13px] font-bold text-dark outline-none px-2 h-8 uppercase"
                  value={customRange?.from ? format(customRange.from, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    const d = parseISO(e.target.value);
                    if (!isNaN(d.getTime())) setCustomRange(prev => ({ from: d, to: prev?.to || d }));
                  }}
                />
                <span className="text-text-muted text-[13px] font-bold">-</span>
                <input 
                  type="date"
                  className="bg-transparent border-none text-[13px] font-bold text-dark outline-none px-2 h-8 uppercase"
                  value={customRange?.to ? format(customRange.to, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    const d = parseISO(e.target.value);
                    if (!isNaN(d.getTime())) setCustomRange(prev => ({ from: prev?.from || d, to: d }));
                  }}
                />
              </div>
              {customRange?.from && customRange?.to && customRange.from > customRange.to && (
                <span className="text-error text-[12px] ml-4 font-bold">Data inicial inválida</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <MetricCard 
            title="Agendamentos" 
            icon={CalendarIcon}
            current={metrics.agendamentos.current} 
            prev={metrics.agendamentos.prev} 
            subLabel1="Concluídos"
            subValue1={metrics.agendamentos.completed}
            subLabel2="Cancelados"
            subValue2={metrics.agendamentos.cancelled}
            invalid={!isValid} 
          />
          <MetricCard 
            title="Clientes Ativos" 
            icon={Users}
            current={metrics.clientes.current} 
            prev={metrics.clientes.prev} 
            subLabel1="Novos"
            subValue1={metrics.clientes.newClients}
            subLabel2="Retorno"
            subValue2={metrics.clientes.current - metrics.clientes.newClients}
            invalid={!isValid} 
          />
          <MetricCard 
            title="Orçamentos" 
            icon={FileText}
            current={metrics.orcamentos.current} 
            prev={metrics.orcamentos.prev} 
            subLabel1="Aprovados"
            subValue1={metrics.orcamentos.approved}
            subLabel2="Aguardando"
            subValue2={metrics.orcamentos.current - metrics.orcamentos.approved}
            invalid={!isValid} 
          />
          <MetricCard 
            title="Receita Projetada" 
            icon={Activity}
            current={metrics.valorOrcamentos.current} 
            prev={metrics.valorOrcamentos.prev} 
            isCurrency 
            highlight 
            subLabel1="Aprovada"
            subValue1={formatCurrency(metrics.orcamentos.approvedVal)}
            invalid={!isValid} 
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
        <section className="lg:col-span-4 flex flex-col h-full">
          <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="p-6 md:p-8 border-b border-border bg-surface flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-dark flex items-center gap-2.5">
                <Activity className="w-[18px] h-[18px] text-primary" strokeWidth={1.8} />
                Atenção comercial
              </h2>
            </div>
            <div className="p-6 md:p-8 space-y-6 flex-1">
              <div 
                className="flex items-center justify-between p-5 rounded-2xl bg-surface-soft/70 border border-border cursor-pointer hover:border-primary/25 hover:bg-primary-soft/45 hover:shadow-sm transition-all group"
                onClick={() => setLocation('/whatsapp')}
              >
                <div className="flex items-center gap-4">
                   <Bell className="w-5 h-5 text-primary" strokeWidth={1.8} />
                  <div>
                     <div className="text-[14px] font-semibold text-dark mb-1">Leads na fila</div>
                     <div className="text-[13px] font-medium text-text-secondary">{leadsNew.length} contatos pendentes</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              
              <div 
                className="flex items-center justify-between p-5 rounded-2xl bg-primary/5 border border-primary/20 cursor-pointer hover:border-primary/40 hover:bg-primary/10 hover:shadow-sm transition-all group"
                onClick={() => setLocation('/servicos')}
              >
                <div className="flex items-center gap-4">
                   <FileText className="w-5 h-5 text-primary" strokeWidth={1.8} />
                  <div>
                     <div className="text-[14px] font-semibold text-dark mb-1">Orçamentos enviados</div>
                    <div className="text-[13px] font-medium text-primary">{leadsQuote.length} propostas aguardando</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-primary/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[12px] font-semibold text-text-secondary">Urgentes ({urgentLeads.length})</h3>
                </div>
                <div className="space-y-3">
                  {urgentLeads.length === 0 ? (
                    <div className="text-center p-6 bg-surface-soft rounded-2xl border border-border">
                      <p className="text-[13px] font-bold text-text-muted uppercase">Nenhum lead urgente.</p>
                    </div>
                  ) : (
                    urgentLeads.map(lead => (
                      <div key={lead.id} className="flex items-center justify-between p-4 rounded-2xl border border-border hover:border-accent/40 hover:shadow-sm cursor-pointer transition-all bg-surface group" onClick={() => setLocation('/whatsapp')}>
                         <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-surface-soft text-text-secondary flex items-center justify-center text-[13px] font-extrabold border border-border group-hover:bg-accent/10 group-hover:text-accent group-hover:border-accent/20 transition-colors">
                             {lead.initials}
                           </div>
                           <div>
                             <div className="text-[14px] font-bold text-dark">{lead.name}</div>
                             <div className="text-[12px] font-medium text-text-secondary">{lead.service}</div>
                           </div>
                         </div>
                         <span className="text-[10px] font-extrabold uppercase tracking-wider text-error bg-error/10 px-2.5 py-1 rounded-full border border-error/20">{lead.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 flex flex-col h-full">
          <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden flex flex-col h-full relative hover:shadow-md transition-shadow">
            <div className="p-6 md:p-8 border-b border-border flex items-center justify-between relative z-10">
              <h2 className="text-[15px] font-semibold text-dark flex items-center gap-2.5">
                <Clock className="w-[18px] h-[18px] text-primary" strokeWidth={1.8} />
                Em atendimento
              </h2>
              <span className="text-[11px] font-medium bg-surface-soft px-3 py-1.5 rounded-full text-text-secondary border border-border">
                {inProgressAppts.length} agora
              </span>
            </div>
            <div className="p-6 md:p-8 flex-1 relative z-10 bg-surface-soft/30">
              {inProgressAppts.length === 0 ? (
                <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-6 shadow-sm border border-border">
                    <Clock className="w-6 h-6 text-text-muted" strokeWidth={2.5} />
                  </div>
                  <p className="text-[16px] font-semibold text-dark">Nenhum atendimento</p>
                  <p className="text-[14px] font-medium text-text-secondary mt-2">As salas estão livres no momento.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {inProgressAppts.map(appt => (
                    <div key={appt.id} className="p-5 rounded-2xl border border-success/30 bg-surface shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:border-success/50">
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-success group-hover:w-2 transition-all" />
                      <div className="flex justify-between items-start mb-5 pl-2">
                        <div>
                          <div className="text-[16px] font-bold text-dark mb-1">{appt.client}</div>
                          <div className="text-[13px] font-semibold text-success uppercase tracking-wide">{appt.service}</div>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20">
                          NA SALA
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold text-text-secondary bg-surface-soft rounded-xl p-3 border border-border ml-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-text-muted" /> {appt.professional}
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-text-muted" /> {appt.room}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-4 flex flex-col h-full">
          <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="p-6 md:p-8 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-[15px] font-semibold text-dark flex items-center gap-2.5">
                <CalendarIcon className="w-[18px] h-[18px] text-primary" strokeWidth={1.8} />
                Agenda
              </h2>
              <div className="flex items-center gap-1 bg-surface-soft p-1.5 rounded-full border border-border shadow-sm">
                <button className="p-2 rounded-full hover:bg-surface text-text-secondary hover:text-primary transition-colors outline-none focus-visible:ring-2 ring-primary/50" onClick={() => setAgendaDate(subDays(agendaDate, 1))}>
                  <ChevronLeft className="w-4 h-4" strokeWidth={3} />
                </button>
                <div className="relative flex-1 text-center min-w-[80px]">
                  <input 
                    type="date" 
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                    value={format(agendaDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        const parsed = parseISO(e.target.value);
                        if (!isNaN(parsed.getTime())) setAgendaDate(parsed);
                      }
                    }}
                  />
                  <div className={cn(
                    "px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest pointer-events-none transition-colors", 
                    isToday(agendaDate) ? "text-primary" : "text-text-secondary"
                  )}>
                    {isToday(agendaDate) ? 'HOJE' : format(agendaDate, 'dd/MM')}
                  </div>
                </div>
                <button className="p-2 rounded-full hover:bg-surface text-text-secondary hover:text-primary transition-colors outline-none focus-visible:ring-2 ring-primary/50" onClick={() => setAgendaDate(addDays(agendaDate, 1))}>
                  <ChevronRight className="w-4 h-4" strokeWidth={3} />
                </button>
              </div>
            </div>
            <div className="p-0 flex-1">
              {agendaAppts.length === 0 ? (
                <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center p-8 bg-surface-soft/30">
                  <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-6 shadow-sm border border-border">
                    <CalendarIcon className="w-6 h-6 text-text-muted" strokeWidth={2.5} />
                  </div>
                  <p className="text-[16px] font-bold text-dark uppercase tracking-wide">Agenda livre</p>
                  <p className="text-[14px] font-medium text-text-secondary mt-2">Nenhum agendamento para {format(agendaDate, "dd 'de' MMMM", { locale: ptBR })}.</p>
                </div>
              ) : (
                <div className="divide-y divide-border h-full max-h-[600px] overflow-y-auto">
                  {agendaAppts.map((app) => {
                    const startLabel = app.start.includes('T') ? format(new Date(app.start), 'HH:mm') : app.start;
                    return (
                      <div key={app.id} 
                           className="flex items-center gap-4 p-5 hover:bg-surface-soft transition-colors cursor-pointer group"
                           onClick={() => setLocation('/agenda')}>
                        <div className="w-16 text-center shrink-0">
                          <span className="text-[16px] font-extrabold text-dark tracking-tight">{startLabel}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-[14px] font-bold text-dark truncate">{app.client}</span>
                            {app.status === 'in_progress' && <span className="text-[9px] uppercase font-extrabold tracking-wider text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20 flex-shrink-0">NA SALA</span>}
                            {app.status === 'completed' && <span className="text-[9px] uppercase font-extrabold tracking-wider text-text-secondary bg-surface border border-border px-2 py-0.5 rounded-full flex-shrink-0">CONCLUÍDO</span>}
                            {app.status === 'cancelled' && <span className="text-[9px] uppercase font-extrabold tracking-wider text-error bg-error/10 px-2 py-0.5 rounded-full border border-error/20 flex-shrink-0">CANCELADO</span>}
                          </div>
                          <div className="text-[12px] font-bold text-text-secondary uppercase tracking-wide truncate mb-2">{app.service}</div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted"><User className="w-3 h-3 text-border" strokeWidth={3} /> {app.professional}</span>
                            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted"><MapPin className="w-3 h-3 text-border" strokeWidth={3} /> {app.room}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-border group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" strokeWidth={2} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}