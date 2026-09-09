import { useListAppointments } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
];

const PROFESSIONALS = [
  { id: '1', name: 'Paula', role: 'Esteticista' },
  { id: '2', name: 'Rosana', role: 'Massoterapeuta' },
  { id: '3', name: 'Wallace', role: 'Massoterapeuta' },
  { id: '4', name: 'Spa', role: 'Recurso' },
];

export function Agenda() {
  const [date, setDate] = useState(new Date());
  
  // Format date as YYYY-MM-DD for API
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: appointments = [], isLoading } = useListAppointments({ date: dateStr });

  const getAppointmentsForProfessionalAndSlot = (professionalName: string, timeSlot: string) => {
    return appointments.filter(app => {
      const appTime = format(new Date(app.start), 'HH:mm');
      return app.professional === professionalName && appTime === timeSlot;
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'confirmed': return 'bg-[#E7EEE4] text-[#596653] border-[#7D8B78]/20';
      case 'in_progress': return 'bg-[rgba(200,169,130,0.16)] text-[#8A6B3F] border-[#C8A982]/20';
      case 'completed': return 'bg-surface-soft text-text-secondary border-border';
      case 'cancelled': return 'bg-[#F4E5E3] text-[#9B5B56] border-[#B96E68]/20';
      default: return 'bg-surface-soft text-text-primary border-border';
    }
  };

  return (
    <div className="flex flex-col h-full h-full space-y-6 max-w-[1400px] mx-auto">
      <PageHeader 
        title="Agenda de Hoje"
        action={
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              Bloquear Horário
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo agendamento
            </Button>
          </div>
        }
      />

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-soft/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setDate(subDays(date, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-3 text-[13px] font-semibold text-text-primary min-w-[140px] text-center capitalize">
                {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setDate(addDays(date, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDate(new Date())}>
              Hoje
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-surface border border-border text-[12px] font-medium text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-[#E7EEE4] border border-[#7D8B78]/20" /> Confirmado
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-surface border border-border text-[12px] font-medium text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-[rgba(200,169,130,0.16)] border border-[#C8A982]/20" /> Em atendimento
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-surface">
          <div className="min-w-[800px]">
            {/* Headers */}
            <div className="flex border-b border-border sticky top-0 bg-surface z-20">
              <div className="w-[80px] shrink-0 border-r border-border bg-surface-soft/30" />
              {PROFESSIONALS.map(prof => (
                <div key={prof.id} className="flex-1 px-4 py-3 border-r border-border bg-surface text-center">
                  <div className="text-[13px] font-semibold text-text-primary">{prof.name}</div>
                  <div className="text-[11px] text-text-muted font-medium mt-0.5">{prof.role}</div>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="relative">
              {isLoading ? (
                <div className="p-8 text-center text-text-muted text-[13px]">Carregando agenda...</div>
              ) : (
                TIME_SLOTS.map(time => (
                  <div key={time} className="flex border-b border-border/50 group hover:bg-surface-soft/30 transition-colors">
                    <div className="w-[80px] shrink-0 border-r border-border p-2 text-right">
                      <span className="text-[12px] font-medium text-text-muted">{time}</span>
                    </div>
                    {PROFESSIONALS.map(prof => {
                      const apps = getAppointmentsForProfessionalAndSlot(prof.name, time);
                      
                      return (
                        <div key={`${prof.id}-${time}`} className="flex-1 border-r border-border p-1 relative min-h-[60px]">
                          {apps.map(app => (
                            <div 
                              key={app.id} 
                              className={cn(
                                "absolute top-1 left-1 right-1 p-2 rounded-[10px] border shadow-sm z-10 flex flex-col gap-1 cursor-pointer transition-transform hover:scale-[1.02]",
                                getStatusColor(app.status)
                              )}
                              style={{ 
                                // Simplified height calculation - in a real app, calculate based on end time
                                minHeight: '52px' 
                              }}
                            >
                              <div className="font-semibold text-[12px] leading-tight truncate">{app.client}</div>
                              <div className="text-[11px] opacity-80 leading-tight truncate">{app.service}</div>
                              <div className="text-[10px] font-medium mt-auto opacity-70 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(app.start), 'HH:mm')} - {format(new Date(app.end), 'HH:mm')}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
