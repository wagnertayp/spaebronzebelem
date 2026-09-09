import { useListAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment, getListAppointmentsQueryKey, useListServices, useListProfessionals } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Trash, X } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment } from '@workspace/api-client-react';

const appointmentTime = (value: string) => {
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '--:--' : format(parsed, 'HH:mm');
};

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00'
];

type DialogState = 
  | { type: 'none' }
  | { type: 'create', time?: string, professional?: string }
  | { type: 'edit', appointment: Appointment }
  | { type: 'edit-block', appointment: Appointment }
  | { type: 'block', time?: string, professional?: string };

export function Agenda() {
  const [date, setDate] = useState(new Date());
  const [dialogState, setDialogState] = useState<DialogState>({ type: 'none' });
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const deleteMutation = useDeleteAppointment();
  
  const { data: services = [] } = useListServices();
  const { data: professionalUsers = [] } = useListProfessionals();
  const professionals = [
    ...professionalUsers
      .filter((professional) => professional.active)
      .map((professional) => ({
        id: String(professional.id),
        name: professional.name,
        role: professional.specialty || 'Profissional',
      })),
    { id: 'resource-spa', name: 'Spa', role: 'Recurso' },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('novo') === '1') {
      setDialogState({ type: 'create' });
      // remove query param without reload
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);
  
  // Format date as YYYY-MM-DD for API
  const dateStr = format(date, 'yyyy-MM-dd');
  const { data: appointments = [], isLoading } = useListAppointments({ date: dateStr });

  const getAppointmentsForProfessionalAndSlot = (professionalName: string, timeSlot: string) => {
    return appointments.filter(app => {
      const appTime = appointmentTime(app.start);
      const matchesTimeAndProf = app.professional === professionalName && appTime === timeSlot;
      if (!matchesTimeAndProf) return false;
      if (statusFilter && app.status !== statusFilter) return false;
      return true;
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
            <Button variant="outline" className="gap-2" onClick={() => setDialogState({ type: 'block' })}>
              <CalendarIcon className="w-4 h-4" />
              Bloquear Horário
            </Button>
            <Button className="gap-2" onClick={() => setDialogState({ type: 'create' })}>
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
            <button 
              onClick={() => setStatusFilter(prev => prev === 'confirmed' ? null : 'confirmed')}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-surface border border-border text-[12px] font-medium transition-colors hover:bg-surface-soft", statusFilter === 'confirmed' ? "ring-2 ring-primary" : "text-text-secondary")}
            >
              <span className="w-2 h-2 rounded-full bg-[#E7EEE4] border border-[#7D8B78]/20" /> Confirmado
            </button>
            <button 
              onClick={() => setStatusFilter(prev => prev === 'in_progress' ? null : 'in_progress')}
              className={cn("flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-surface border border-border text-[12px] font-medium transition-colors hover:bg-surface-soft", statusFilter === 'in_progress' ? "ring-2 ring-primary" : "text-text-secondary")}
            >
              <span className="w-2 h-2 rounded-full bg-[rgba(200,169,130,0.16)] border border-[#C8A982]/20" /> Em atendimento
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-surface">
          <div className="min-w-[800px]">
            {/* Headers */}
            <div className="flex border-b border-border sticky top-0 bg-surface z-20">
              <div className="w-[80px] shrink-0 border-r border-border bg-surface-soft/30" />
              {professionals.map(prof => (
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
                    {professionals.map(prof => {
                      const apps = getAppointmentsForProfessionalAndSlot(prof.name, time);
                      
                      return (
                        <div 
                          key={`${prof.id}-${time}`} 
                          className="flex-1 border-r border-border p-1 relative min-h-[60px] cursor-pointer"
                          onClick={(e) => {
                            if (e.target === e.currentTarget) {
                              setDialogState({ type: 'create', time, professional: prof.name });
                            }
                          }}
                        >
                          {apps.map(app => (
                            <div 
                              key={app.id} 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (app.client === 'Horário bloqueado') {
                                  setDialogState({ type: 'edit-block', appointment: app });
                                } else {
                                  setDialogState({ type: 'edit', appointment: app });
                                }
                              }}
                              className={cn(
                                "absolute top-1 left-1 right-1 p-2 rounded-[10px] border shadow-sm z-10 flex flex-col gap-1 cursor-pointer transition-transform hover:scale-[1.02]",
                                app.client === 'Horário bloqueado' ? 'bg-surface-soft border-border border-dashed opacity-70' : getStatusColor(app.status)
                              )}
                              style={{ 
                                minHeight: '52px' 
                              }}
                            >
                              <div className={cn("font-semibold text-[12px] leading-tight truncate", app.client === 'Horário bloqueado' && "italic text-text-muted")}>
                                {app.client}
                              </div>
                              {app.client !== 'Horário bloqueado' && (
                                <div className="text-[11px] opacity-80 leading-tight truncate">{app.service}</div>
                              )}
                              <div className="text-[10px] font-medium mt-auto opacity-70 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {appointmentTime(app.start)} - {appointmentTime(app.end)}
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

      <Dialog open={dialogState.type !== 'none'} onOpenChange={(open) => !open && setDialogState({ type: 'none' })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {dialogState.type === 'create' && 'Novo Agendamento'}
              {dialogState.type === 'edit' && 'Editar Agendamento'}
              {dialogState.type === 'block' && 'Bloquear Horário'}
              {dialogState.type === 'edit-block' && 'Horário Bloqueado'}
            </DialogTitle>
          </DialogHeader>
          
          {dialogState.type === 'edit-block' ? (
            <>
              <div className="py-4 space-y-4">
                <div className="flex justify-between items-center bg-surface-soft p-3 rounded-lg border border-border">
                  <div className="text-sm">
                    <div className="text-text-muted mb-1 text-[11px] uppercase tracking-wider font-semibold">Motivo</div>
                    <div className="font-medium">{dialogState.appointment.service !== 'Bloqueio' ? dialogState.appointment.service : 'Não informado'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-soft p-3 rounded-lg border border-border">
                    <div className="text-text-muted mb-1 text-[11px] uppercase tracking-wider font-semibold">Profissional</div>
                    <div className="font-medium text-sm">{dialogState.appointment.professional}</div>
                  </div>
                  <div className="bg-surface-soft p-3 rounded-lg border border-border">
                    <div className="text-text-muted mb-1 text-[11px] uppercase tracking-wider font-semibold">Horário</div>
                    <div className="font-medium text-sm">
                      {appointmentTime(dialogState.appointment.start)} às {appointmentTime(dialogState.appointment.end)}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => {
                    deleteMutation.mutate({ id: dialogState.appointment.id }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                        setDialogState({ type: 'none' });
                        toast({ title: "Horário desbloqueado!" });
                      },
                      onError: () => {
                        toast({ title: "Erro", description: "Não foi possível desbloquear o horário.", variant: "destructive" });
                      }
                    });
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash className="w-4 h-4" /> Desbloquear
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogState({ type: 'none' })}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            
            const startStr = formData.get('start') as string;
            const endStr = formData.get('end') as string;
            const startDate = new Date(`${dateStr}T${startStr}:00`);
            const endDate = new Date(`${dateStr}T${endStr}:00`);
            
            if (endDate <= startDate) {
              toast({ title: "Erro", description: "O horário de término deve ser posterior ao início.", variant: "destructive" });
              return;
            }

            const start = startDate.toISOString();
            const end = endDate.toISOString();

            if (dialogState.type === 'block') {
              createMutation.mutate({
                data: {
                  client: 'Horário bloqueado',
                  service: formData.get('service') as string || 'Bloqueio',
                  professional: formData.get('professional') as string,
                  room: formData.get('room') as string || 'N/A',
                  start,
                  end
                }
              }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                  setDialogState({ type: 'none' });
                  toast({ title: "Horário bloqueado com sucesso!" });
                },
                onError: () => {
                  toast({ title: "Erro", description: "Não foi possível bloquear o horário.", variant: "destructive" });
                }
              });
              return;
            }

            if (dialogState.type === 'create') {
              createMutation.mutate({
                data: {
                  client: formData.get('client') as string,
                  service: formData.get('service') as string,
                  professional: formData.get('professional') as string,
                  room: formData.get('room') as string,
                  start,
                  end
                }
              }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                  setDialogState({ type: 'none' });
                  toast({ title: "Agendamento criado!" });
                },
                onError: () => {
                  toast({ title: "Erro", description: "Não foi possível criar o agendamento.", variant: "destructive" });
                }
              });
              return;
            }

            if (dialogState.type === 'edit') {
              const status = formData.get('status') as any;
              updateMutation.mutate({
                id: dialogState.appointment.id,
                data: {
                  client: formData.get('client') as string,
                  service: formData.get('service') as string,
                  professional: formData.get('professional') as string,
                  room: formData.get('room') as string,
                  start,
                  end,
                  status
                }
              }, {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                  setDialogState({ type: 'none' });
                  toast({ title: "Agendamento atualizado!" });
                },
                onError: () => {
                  toast({ title: "Erro", description: "Não foi possível atualizar o agendamento.", variant: "destructive" });
                }
              });
            }
          }}>
            <div className="grid gap-4 py-4">
              {dialogState.type !== 'block' && (
                <div className="space-y-2">
                  <Label htmlFor="client">Cliente</Label>
                  <Input 
                    id="client" 
                    name="client" 
                    required 
                    defaultValue={dialogState.type === 'edit' ? dialogState.appointment.client : ''}
                    placeholder="Nome do cliente"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service">{dialogState.type === 'block' ? 'Motivo (opcional)' : 'Serviço'}</Label>
                  {dialogState.type === 'block' ? (
                    <Input id="service" name="service" placeholder="Ex: Manutenção" />
                  ) : (
                    <select 
                      id="service" 
                      name="service" 
                      required 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      defaultValue={dialogState.type === 'edit' ? dialogState.appointment.service : ''}
                    >
                      <option value="">Selecione...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="professional">Profissional</Label>
                  <select 
                    id="professional" 
                    name="professional" 
                    required 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue={
                      dialogState.type === 'edit' ? dialogState.appointment.professional : 
                      dialogState.type !== 'none' ? (dialogState.professional || '') : ''
                    }
                  >
                    <option value="">Selecione...</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="room">Sala</Label>
                  <select 
                    id="room" 
                    name="room" 
                    required 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue={dialogState.type === 'edit' ? dialogState.appointment.room : ''}
                  >
                    <option value="">Selecione...</option>
                    <option value="Sala 01">Sala 01</option>
                    <option value="Sala 02">Sala 02</option>
                    <option value="Sala 03">Sala 03</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start">Início</Label>
                  <Input 
                    id="start" 
                    name="start" 
                    type="time" 
                    required 
                    defaultValue={
                      dialogState.type === 'edit' ? appointmentTime(dialogState.appointment.start) : 
                      dialogState.type !== 'none' ? (dialogState.time || '10:00') : '10:00'
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end">Fim</Label>
                  <Input 
                    id="end" 
                    name="end" 
                    type="time" 
                    required 
                    defaultValue={
                      dialogState.type === 'edit' ? appointmentTime(dialogState.appointment.end) : 
                      dialogState.type !== 'none' ? (
                        dialogState.time ? 
                          `${String(parseInt(dialogState.time.split(':')[0]) + 1).padStart(2, '0')}:${dialogState.time.split(':')[1]}` 
                          : '11:00'
                      ) : '11:00'
                    }
                  />
                </div>
              </div>

              {dialogState.type === 'edit' && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select 
                    id="status" 
                    name="status" 
                    required 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue={dialogState.appointment.status}
                  >
                    <option value="confirmed">Confirmado</option>
                    <option value="in_progress">Em atendimento</option>
                    <option value="completed">Concluído</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              )}
            </div>
            
            <DialogFooter className="gap-2 sm:justify-between">
              {dialogState.type === 'edit' ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="gap-2"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir?')) {
                      deleteMutation.mutate({ id: dialogState.appointment.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
                          setDialogState({ type: 'none' });
                          toast({ title: "Agendamento excluído!" });
                        },
                        onError: () => {
                          toast({ title: "Erro", description: "Não foi possível excluir o agendamento.", variant: "destructive" });
                        }
                      });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash className="w-4 h-4" /> Excluir
                </Button>
              ) : (
                <div /> // Spacer
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogState({ type: 'none' })}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
