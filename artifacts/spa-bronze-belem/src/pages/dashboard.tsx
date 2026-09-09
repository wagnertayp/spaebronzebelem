import { useState } from 'react';
import { useGetDashboard, useListAppointments } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, TrendingUp, TrendingDown, Minus, Clock, MapPin, User, ChevronRight, ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays, subDays, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLocation } from 'wouter';

function MetricTrend({ trend, change }: { trend: string; change: string }) {
  if (trend === 'up') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-[6px]">
        <TrendingUp className="w-3 h-3" />
        {change}
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-error bg-error/10 px-2 py-0.5 rounded-[6px]">
        <TrendingDown className="w-3 h-3" />
        {change}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-text-muted bg-surface-soft px-2 py-0.5 rounded-[6px]">
      <Minus className="w-3 h-3" />
      {change}
    </span>
  );
}

const parseTime = (timeStr: string) => {
  if (timeStr.includes('T')) return new Date(timeStr);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours || 0, minutes || 0, 0, 0);
  return d;
};

export function Dashboard() {
  const [_, setLocation] = useLocation();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  const { data: dashboard, isLoading: isDashboardLoading } = useGetDashboard();
  const { data: appointments = [], isLoading: isAppointmentsLoading } = useListAppointments({ date: dateStr });

  if (isDashboardLoading || !dashboard) {
    return (
      <div className="animate-pulse space-y-8 max-w-[1200px] mx-auto pb-12">
        <div className="h-12 w-1/3 bg-surface-soft rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-surface-soft rounded-[18px]" />
          ))}
        </div>
      </div>
    );
  }

  const displayAppointments = [...appointments]
    .sort((a, b) => parseTime(a.start).getTime() - parseTime(b.start).getTime());

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-12">
      <PageHeader 
        title={dashboard.greeting}
        description={dashboard.subtitle}
        action={
          <Button className="gap-2" onClick={() => setLocation('/agenda?novo=1')}>
            <Plus className="w-4 h-4" />
            Novo agendamento
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboard.metrics.map((metric, i) => (
          <Card key={i}>
            <CardContent className="p-5 flex flex-col gap-3">
              <span className="text-[13px] font-semibold text-text-secondary">
                {metric.label}
              </span>
              <div className="flex items-end justify-between">
                <span className="text-[26px] font-semibold tracking-[-0.035em] text-text-primary leading-none">
                  {metric.value}
                </span>
              </div>
              <div>
                <MetricTrend trend={metric.trend} change={metric.change} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Visão geral</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.revenue && dashboard.revenue.length > 0 && (
                <div className="mb-6">
                  <div className="text-[13px] text-text-secondary mb-1">{dashboard.revenue[0].label || 'Total'}</div>
                  <div className="text-[32px] font-semibold tracking-[-0.04em] text-text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboard.revenue[0].value)}
                  </div>
                </div>
              )}
              
              {dashboard.serviceMix && dashboard.serviceMix.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="text-[13px] font-medium text-text-primary">Mix de Serviços</div>
                  <div className="flex flex-col gap-3">
                    {dashboard.serviceMix.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-[13px] font-medium text-text-primary">{item.service}</span>
                          <span className="text-[13px] text-text-secondary">{item.value}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {dashboard.currentAppointment && (
            <Card className="bg-dark text-text-primary border-none overflow-hidden relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
              <CardHeader className="pb-2 relative z-10">
                <CardTitle className="text-primary-soft text-[11px] uppercase tracking-wider">Atendimento Atual</CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="flex flex-col gap-5 mt-2">
                  <div>
                    <div className="text-[18px] font-semibold text-white mb-1">
                      {dashboard.currentAppointment.client}
                    </div>
                    <div className="text-[14px] text-primary-soft">
                      {dashboard.currentAppointment.service}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-accent" />
                      <span className="text-[12px] text-primary-soft">{dashboard.currentAppointment.professional}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent" />
                      <span className="text-[12px] text-primary-soft">{dashboard.currentAppointment.room}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <Clock className="w-4 h-4 text-accent" />
                      <span className="text-[12px] text-primary-soft">
                        {dashboard.currentAppointment.start.includes('T') ? format(new Date(dashboard.currentAppointment.start), 'HH:mm') : dashboard.currentAppointment.start} 
                        {' — '} 
                        {dashboard.currentAppointment.end.includes('T') ? format(new Date(dashboard.currentAppointment.end), 'HH:mm') : dashboard.currentAppointment.end}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4 border-b border-border mb-4">
              <CardTitle className="capitalize text-[18px]">
                Agenda de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedDate(new Date())} 
                  className={cn(isToday(selectedDate) && "bg-primary/10 text-primary border-primary/20")}
                >
                  Hoje
                </Button>
                <div className="relative">
                  <input 
                    type="date" 
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      if (e.target.value) {
                        const parsed = parseISO(e.target.value);
                        if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
                      }
                    }}
                  />
                  <Button variant="outline" size="icon" className="pointer-events-none">
                    <CalendarIcon className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-4">
                {isAppointmentsLoading ? (
                  <div className="text-center text-sm text-text-muted py-8">Carregando agenda...</div>
                ) : displayAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                    <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center mb-3">
                      <Clock className="w-5 h-5 text-text-muted" />
                    </div>
                    <div className="text-[14px] font-medium text-text-primary mb-1">Nenhum agendamento</div>
                    <div className="text-[13px] text-text-secondary">A agenda está livre para este dia.</div>
                  </div>
                ) : (
                  displayAppointments.map((app) => {
                    const startLabel = app.start.includes('T') ? format(new Date(app.start), 'HH:mm') : app.start;
                    return (
                      <div key={app.id} 
                           className="flex items-start gap-4 cursor-pointer group hover:bg-surface-soft/50 p-2 -mx-2 rounded-xl transition-colors"
                           onClick={() => setLocation('/agenda')}>
                        <div className="w-12 text-right shrink-0 pt-2">
                          <span className="text-[13px] font-semibold text-text-primary">
                            {startLabel}
                          </span>
                        </div>
                        <div className="flex-1 bg-surface-soft rounded-[12px] p-4 border border-border relative overflow-hidden group-hover:border-primary/30 transition-colors">
                          {app.status === 'in_progress' && <div className="absolute top-0 left-0 w-1 h-full bg-warning" />}
                          {app.status === 'confirmed' && <div className="absolute top-0 left-0 w-1 h-full bg-success" />}
                          {app.status === 'completed' && <div className="absolute top-0 left-0 w-1 h-full bg-text-muted" />}
                          
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="text-[14px] font-semibold text-text-primary">{app.client}</div>
                            {app.status === 'completed' && <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Concluído</span>}
                            {app.status === 'cancelled' && <span className="text-[10px] uppercase font-bold tracking-wider text-error">Cancelado</span>}
                          </div>
                          <div className="text-[13px] text-text-secondary mb-3">{app.service}</div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-medium text-text-muted bg-surface px-2.5 py-1 rounded-[6px] border border-border flex items-center gap-1.5">
                              <MapPin className="w-3 h-3" /> {app.room}
                            </span>
                            <span className="text-[11px] font-medium text-text-muted bg-surface px-2.5 py-1 rounded-[6px] border border-border flex items-center gap-1.5">
                              <User className="w-3 h-3" /> {app.professional}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <Button variant="ghost" className="w-full text-primary" onClick={() => setLocation('/agenda')}>
                  Ir para a Agenda completa <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
