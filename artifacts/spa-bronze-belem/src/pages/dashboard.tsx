import { useGetDashboard } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, TrendingUp, TrendingDown, Minus, Clock, MapPin, User, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export function Dashboard() {
  const { data: dashboard, isLoading } = useGetDashboard();

  if (isLoading || !dashboard) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-12 w-1/3 bg-surface-soft rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-surface-soft rounded-[18px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      <PageHeader 
        title={dashboard.greeting}
        description={dashboard.subtitle}
        action={
          <Button className="gap-2">
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
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Faturamento Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.revenue} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                      tickFormatter={(value) => `R$${value/1000}k`}
                    />
                    <Tooltip 
                      cursor={{ fill: 'var(--color-surface-soft)' }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="var(--color-primary)" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Mix de Serviços</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center">
                <div className="h-[180px] w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboard.serviceMix}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {dashboard.serviceMix.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 flex flex-col gap-3 pl-4">
                  {dashboard.serviceMix.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium text-text-primary leading-tight">{item.service}</span>
                        <span className="text-[11px] text-text-secondary">{item.value}%</span>
                      </div>
                    </div>
                  ))}
                </div>
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
                          {dashboard.currentAppointment.start} — {dashboard.currentAppointment.end}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Próximos Hoje</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-primary">
                Ver agenda <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex flex-col gap-4 mt-4">
                {/* Mocking some upcoming appointments since API only returns current */}
                <div className="flex items-start gap-4">
                  <div className="w-12 text-right shrink-0 pt-1">
                    <span className="text-[13px] font-semibold text-text-primary">14:00</span>
                  </div>
                  <div className="flex-1 bg-surface-soft rounded-[12px] p-3 border border-border">
                    <div className="text-[13px] font-semibold text-text-primary mb-0.5">Mariana Costa</div>
                    <div className="text-[12px] text-text-secondary mb-2">Drenagem Linfática</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-text-muted bg-surface px-2 py-0.5 rounded-[4px] border border-border">Sala 01</span>
                      <span className="text-[11px] font-medium text-text-muted bg-surface px-2 py-0.5 rounded-[4px] border border-border">Paula</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 text-right shrink-0 pt-1">
                    <span className="text-[13px] font-semibold text-text-primary">15:30</span>
                  </div>
                  <div className="flex-1 bg-surface-soft rounded-[12px] p-3 border border-border relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-warning" />
                    <div className="text-[13px] font-semibold text-text-primary mb-0.5">Juliana Alves</div>
                    <div className="text-[12px] text-text-secondary mb-2">Ritual Facial</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-text-muted bg-surface px-2 py-0.5 rounded-[4px] border border-border">Sala 03</span>
                      <span className="text-[11px] font-medium text-text-muted bg-surface px-2 py-0.5 rounded-[4px] border border-border">Rosana</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 text-right shrink-0 pt-1">
                    <span className="text-[13px] font-semibold text-text-primary">16:45</span>
                  </div>
                  <div className="flex-1 bg-surface-soft rounded-[12px] p-3 border border-border">
                    <div className="text-[13px] font-semibold text-text-primary mb-0.5">Carlos Almeida</div>
                    <div className="text-[12px] text-text-secondary mb-2">Massagem Terapêutica</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-text-muted bg-surface px-2 py-0.5 rounded-[4px] border border-border">Sala 02</span>
                      <span className="text-[11px] font-medium text-text-muted bg-surface px-2 py-0.5 rounded-[4px] border border-border">Wallace</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
