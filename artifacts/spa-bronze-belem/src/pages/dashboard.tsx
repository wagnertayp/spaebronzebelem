import { useState, useMemo } from 'react';
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
  ArrowRight
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
    if (current > 0) return { trend: 'up', text: 'Novo no período' };
    return { trend: 'neutral', text: 'Sem alteração' };
  }
  
  const diff = current - previous;
  if (diff === 0) return { trend: 'neutral', text: 'Sem alteração' };
  
  const percent = Math.round((Math.abs(diff) / previous) * 100);
  const trend = diff > 0 ? 'up' : 'down';
  return { trend, text: `${percent}% vs. período anterior` };
}

function MetricTrend({ trend, change }: { trend: string; change: string }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-[6px]">
        <TrendingUp className="w-3 h-3" />
        {change}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-error bg-error/10 px-2 py-0.5 rounded-[6px]">
        <TrendingDown className="w-3 h-3" />
        {change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-muted bg-black/5 px-2 py-0.5 rounded-[6px]">
      <Minus className="w-3 h-3" />
      {change}
    </span>
  );
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

function MetricCard({ 
  title, current, prev, isCurrency, tone = 'blue', highlight = false, invalid = false
}: { 
  title: string; current: number; prev: number; isCurrency?: boolean; tone?: 'blue' | 'cyan' | 'violet' | 'navy'; highlight?: boolean; invalid?: boolean
}) {
  const trend = invalid ? { trend: 'neutral', text: 'Período inválido' } : getTrend(current, prev);
  const displayValue = isCurrency ? formatCurrency(current) : current;
  
  return (
    <div className={cn(
      "p-5 rounded-[16px] border flex flex-col gap-3 shadow-card transition-transform hover:-translate-y-0.5",
      tone === 'blue' && "bg-[#E8F2FF] border-[#BBD8FF]",
      tone === 'cyan' && "bg-[#E5F8FC] border-[#B4E8F2]",
      tone === 'violet' && "bg-[#F0ECFF] border-[#D8CEFF]",
      tone === 'navy' && "bg-primary text-white border-primary shadow-button"
    )}>
      <span className={cn("text-[13px] font-bold", tone === 'navy' ? "text-white/80" : "text-text-secondary")}>
        {title}
      </span>
      <div className="flex items-end justify-between mt-1">
        <span className={cn("text-[28px] font-bold tracking-[-0.03em] leading-none", tone === 'navy' ? "text-white" : "text-dark", invalid && "text-text-muted")}>
          {invalid ? '-' : displayValue}
        </span>
      </div>
      <div>
        <div className={cn(tone === 'navy' && "[&_span]:bg-white/15 [&_span]:text-white")}>
          <MetricTrend trend={trend.trend} change={trend.text} />
        </div>
      </div>
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
        agendamentos: { current: 0, prev: 0 },
        clientes: { current: 0, prev: 0 },
        orcamentos: { current: 0, prev: 0 },
        valorOrcamentos: { current: 0, prev: 0 },
      };
    }

    let apptsCurrent = 0;
    let apptsPrev = 0;
    
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
      } else if (isWithinInterval(d, { start: prevFrom, end: prevTo })) {
        apptsPrev++;
      }
    });

    let clientsCurrent = 0;
    let clientsPrev = 0;
    
    allClients.forEach(c => {
      const d = parseSafeDate(c.lastVisit);
      if (!d) return;
      if (isWithinInterval(d, { start: from, end: to })) {
        clientsCurrent++;
      } else if (isWithinInterval(d, { start: prevFrom, end: prevTo })) {
        clientsPrev++;
      }
    });

    let quotesCurrent = 0;
    let quotesPrev = 0;
    let quotesValCurrent = 0;
    let quotesValPrev = 0;
    
    allQuotes.forEach(q => {
      const d = new Date(q.createdAt);
      if (isWithinInterval(d, { start: from, end: to })) {
        quotesCurrent++;
        quotesValCurrent += q.total;
      } else if (isWithinInterval(d, { start: prevFrom, end: prevTo })) {
        quotesPrev++;
        quotesValPrev += q.total;
      }
    });
    
    return {
      agendamentos: { current: apptsCurrent, prev: apptsPrev },
      clientes: { current: clientsCurrent, prev: clientsPrev },
      orcamentos: { current: quotesCurrent, prev: quotesPrev },
      valorOrcamentos: { current: quotesValCurrent, prev: quotesValPrev },
    };
  }, [allAppointments, allQuotes, allClients, from, to, prevFrom, prevTo, isValid, now]);

  const leadsNew = allLeads.filter(l => l.stage === 'new' || l.stage === 'contacting');
  const leadsQuote = allLeads.filter(l => l.stage === 'quote');
  const urgentLeads = allLeads
    .filter(l => l.stage !== 'converted' && l.stage !== 'lost')
    .slice(0, 3);

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
      <div className="animate-pulse space-y-8 max-w-[1200px] mx-auto pb-12 px-4 sm:px-6 mt-8">
        <div className="h-16 w-1/3 bg-black/5 rounded-[12px]" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-[120px] bg-black/5 rounded-[12px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 h-[300px] bg-black/5 rounded-[12px]" />
          <div className="lg:col-span-7 h-[300px] bg-black/5 rounded-[12px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-[1200px] mx-auto pb-16 px-4 sm:px-6 relative">
      <div className="absolute top-0 right-0 w-full max-w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-accent/8 to-transparent -z-10 pointer-events-none opacity-70 rounded-bl-[100%]" />
      
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-10 pb-6 border-b border-primary/15">
        <div>
          <h1 className="text-[32px] md:text-[38px] font-medium tracking-tight text-dark">
            {getGreeting()}, Wagner.
          </h1>
          <p className="text-text-secondary mt-1.5 text-[15px]">
            Aqui está o resumo das suas operações de bem-estar.
          </p>
        </div>
        
        <Button 
          className="rounded-[12px] bg-primary text-white hover:bg-primary-dark shadow-button h-11 px-5"
          onClick={() => setLocation('/agenda?novo=1')}
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo agendamento
        </Button>
      </header>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(['today', '7d', '30d', 'custom'] as const).map(p => (
            <button 
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-[12px] text-[13px] font-medium transition-colors border", 
                period === p 
                  ? 'bg-primary text-white border-primary shadow-sm' 
                  : 'bg-white text-text-secondary border-primary/15 hover:border-primary/40 hover:text-primary'
              )}
            >
              {p === 'today' && 'Hoje'}
              {p === '7d' && '7 dias'}
              {p === '30d' && '30 dias'}
              {p === 'custom' && 'Personalizado'}
            </button>
          ))}
          
          {period === 'custom' && (
            <div className="flex flex-col gap-1 ml-2">
              <div className="flex items-center gap-2 bg-white rounded-[12px] p-1 border border-primary/20">
                <input 
                  type="date"
                  className="bg-transparent border-none text-[13px] text-dark outline-none px-2 h-8"
                  value={customRange?.from ? format(customRange.from, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    const d = parseISO(e.target.value);
                    if (!isNaN(d.getTime())) setCustomRange(prev => ({ from: d, to: prev?.to || d }));
                  }}
                />
                <span className="text-text-muted text-[13px]">-</span>
                <input 
                  type="date"
                  className="bg-transparent border-none text-[13px] text-dark outline-none px-2 h-8"
                  value={customRange?.to ? format(customRange.to, 'yyyy-MM-dd') : ''}
                  onChange={e => {
                    const d = parseISO(e.target.value);
                    if (!isNaN(d.getTime())) setCustomRange(prev => ({ from: prev?.from || d, to: d }));
                  }}
                />
              </div>
              {customRange?.from && customRange?.to && customRange.from > customRange.to && (
                <span className="text-error text-[12px] ml-1 font-medium">A data inicial deve ser anterior à data final.</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Agendamentos" current={metrics.agendamentos.current} prev={metrics.agendamentos.prev} tone="blue" invalid={!isValid} />
          <MetricCard title="Clientes atendidos" current={metrics.clientes.current} prev={metrics.clientes.prev} tone="cyan" invalid={!isValid} />
          <MetricCard title="Orçamentos criados" current={metrics.orcamentos.current} prev={metrics.orcamentos.prev} tone="violet" invalid={!isValid} />
          <MetricCard title="Valor em orçamentos" current={metrics.valorOrcamentos.current} prev={metrics.valorOrcamentos.prev} isCurrency tone="navy" highlight invalid={!isValid} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-5">
          <h2 className="text-[17px] font-semibold text-dark flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-warning" />
            Atenção Comercial
          </h2>
          <div className="bg-surface rounded-[16px] border border-primary/15 p-5 space-y-4 shadow-card">
            <div 
              className="flex items-center justify-between p-3.5 rounded-[12px] bg-primary-soft/40 border border-primary/10 cursor-pointer hover:border-primary/35 hover:bg-primary-soft/70 transition-colors group"
              onClick={() => setLocation('/whatsapp')}
            >
              <div>
                <div className="text-[14px] font-medium text-dark mb-0.5">Leads aguardando resposta</div>
                <div className="text-[12.5px] text-text-secondary">{leadsNew.length} contatos pendentes</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            
            <div 
              className="flex items-center justify-between p-3.5 rounded-[12px] bg-primary-soft/40 border border-primary/10 cursor-pointer hover:border-primary/35 hover:bg-primary-soft/70 transition-colors group"
              onClick={() => setLocation('/servicos')}
            >
              <div>
                <div className="text-[14px] font-medium text-dark mb-0.5">Orçamentos aguardando retorno</div>
                <div className="text-[12.5px] text-text-secondary">{leadsQuote.length} propostas enviadas</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Leads Urgentes</span>
                <button className="text-[12px] text-primary font-bold hover:text-primary-dark transition-colors" onClick={() => setLocation('/whatsapp')}>Ver todos</button>
              </div>
              <div className="space-y-2.5">
                {urgentLeads.length === 0 ? (
                  <div className="text-[13px] text-text-muted text-center py-4">Nenhum lead urgente</div>
                ) : (
                  urgentLeads.map(lead => (
                    <div key={lead.id} className="flex items-center justify-between text-[13px] p-2 -mx-2 rounded-[8px] hover:bg-black/5 transition-colors cursor-pointer" onClick={() => setLocation('/whatsapp')}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                          {lead.initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-dark leading-tight">{lead.name}</span>
                          <span className="text-[11px] text-text-muted">{lead.service}</span>
                        </div>
                      </div>
                      <span className="text-warning font-medium text-[12px] bg-warning/10 px-2 py-0.5 rounded-[4px]">{lead.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <h2 className="text-[17px] font-semibold text-dark flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success" />
            Equipe em Atendimento
          </h2>
          <div className="bg-gradient-to-br from-primary-dark to-dark-soft rounded-[16px] p-6 text-white h-[calc(100%-48px)] min-h-[300px] shadow-container">
            {inProgressAppts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                <Clock className="w-8 h-8 mb-3" />
                <p className="text-[15px] font-medium">Nenhum atendimento no momento</p>
                <p className="text-[13px] mt-1 text-white/70">As salas estão livres.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full content-start">
                {inProgressAppts.map(appt => (
                  <div key={appt.id} className="bg-white/10 rounded-[10px] p-4 border border-white/5 hover:bg-white/15 transition-colors">
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="text-[14px] font-semibold tracking-wide">{appt.client}</div>
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-warning/20 text-warning px-1.5 py-0.5 rounded-[4px]">Agora</span>
                    </div>
                    <div className="text-[12px] text-white/70 mb-4">{appt.service}</div>
                    <div className="flex flex-col gap-2 text-[12px] text-white/80">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 opacity-60" /> {appt.professional}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 opacity-60" /> {appt.room}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 opacity-60" /> 
                        {appt.start.includes('T') ? format(new Date(appt.start), 'HH:mm') : appt.start} 
                        {' — '} 
                        {appt.end.includes('T') ? format(new Date(appt.end), 'HH:mm') : appt.end}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-t border-accent/20 pt-10">
          <h2 className="text-[20px] font-semibold text-dark capitalize">
            Agenda de {format(agendaDate, "dd 'de' MMMM", { locale: ptBR })}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5 bg-surface p-1 rounded-[12px] border border-accent/10 shadow-sm shadow-accent/5">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-black/5" onClick={() => setAgendaDate(subDays(agendaDate, 1))}>
              <ChevronLeft className="w-4 h-4 text-text-secondary" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn("h-8 rounded-[8px] text-[13px] hover:bg-black/5", isToday(agendaDate) && "bg-primary/10 text-primary font-medium hover:bg-primary/20")}
              onClick={() => setAgendaDate(now)}
            >
              Hoje
            </Button>
            <div className="relative">
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
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] pointer-events-none text-text-secondary">
                <CalendarIcon className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] hover:bg-black/5" onClick={() => setAgendaDate(addDays(agendaDate, 1))}>
              <ChevronRight className="w-4 h-4 text-text-secondary" />
            </Button>
          </div>
        </div>

        <div className="bg-[#FDFBF7] rounded-[16px] border border-accent/10 overflow-hidden shadow-sm shadow-accent/5">
          {agendaAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div className="text-[15px] font-medium text-dark mb-1">Nenhum agendamento</div>
              <div className="text-[14px] text-text-secondary">A agenda está livre para este dia.</div>
            </div>
          ) : (
            <div className="divide-y divide-accent/10">
              {agendaAppts.map((app) => {
                const startLabel = app.start.includes('T') ? format(new Date(app.start), 'HH:mm') : app.start;
                const endLabel = app.end.includes('T') ? format(new Date(app.end), 'HH:mm') : app.end;
                return (
                  <div key={app.id} 
                       className="flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer hover:bg-black/5 p-4 sm:p-5 transition-colors group"
                       onClick={() => setLocation('/agenda')}>
                    <div className="w-20 shrink-0">
                      <span className="text-[14px] font-semibold text-dark">
                        {startLabel}
                      </span>
                      <div className="text-[11px] text-text-muted mt-0.5">{endLabel}</div>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-[15px] font-semibold text-dark">{app.client}</div>
                          {app.status === 'in_progress' && <span className="text-[10px] uppercase font-bold tracking-wider text-warning bg-warning/10 px-1.5 py-0.5 rounded-[4px]">Em andamento</span>}
                          {app.status === 'completed' && <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted bg-black/5 px-1.5 py-0.5 rounded-[4px]">Concluído</span>}
                          {app.status === 'cancelled' && <span className="text-[10px] uppercase font-bold tracking-wider text-error bg-error/10 px-1.5 py-0.5 rounded-[4px]">Cancelado</span>}
                        </div>
                        <div className="text-[13px] text-text-secondary">{app.service}</div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                        <User className="w-4 h-4 text-accent/60" /> {app.professional}
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-[13px] text-text-secondary sm:justify-end">
                        <MapPin className="w-4 h-4 text-accent/60" /> {app.room}
                      </div>
                    </div>
                    
                    <div className="hidden sm:block shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-accent/20 text-accent shadow-sm">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}