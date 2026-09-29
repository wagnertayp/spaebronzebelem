import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Professional, useCreateProfessional, useUpdateProfessional, getListProfessionalsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import {
  createEmptyWeeklySchedule,
  ProfessionalAvailabilityEditor,
} from "./ProfessionalAvailabilityEditor";
import type {
  ProfessionalScheduleException,
  WeeklyScheduleDay,
} from "@workspace/api-client-react";

const professionalSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  specialty: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  commissionRate: z.coerce.number().min(0).max(100),
  active: z.boolean().default(true),
});

type ProfessionalForm = z.infer<typeof professionalSchema>;

export function ProfessionalDialog({ 
  open, 
  onOpenChange, 
  professional 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  professional: Professional | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const createMutation = useCreateProfessional();
  const updateMutation = useUpdateProfessional();
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleDay[]>(createEmptyWeeklySchedule());
  const [scheduleExceptions, setScheduleExceptions] = useState<ProfessionalScheduleException[]>([]);

  const form = useForm<ProfessionalForm>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      name: "",
      specialty: "",
      phone: "",
      email: "",
      commissionRate: 0,
      active: true,
    }
  });

  useEffect(() => {
    if (open) {
      if (professional) {
        form.reset({
          name: professional.name,
          specialty: professional.specialty ?? "",
          phone: professional.phone ?? "",
          email: professional.email ?? "",
          commissionRate: professional.commissionRate,
          active: professional.active,
        });
        setWeeklySchedule(professional.weeklySchedule);
        setScheduleExceptions(professional.scheduleExceptions);
      } else {
        form.reset({
          name: "",
          specialty: "",
          phone: "",
          email: "",
          commissionRate: 0,
          active: true,
        });
        setWeeklySchedule(createEmptyWeeklySchedule());
        setScheduleExceptions([]);
      }
    }
  }, [open, professional, form]);

  const onSubmit = (data: ProfessionalForm) => {
    const incompleteEnabledDay = weeklySchedule.find((day) => day.enabled && day.intervals.length === 0);
    const invalidInterval = weeklySchedule.some((day) =>
      day.intervals.some((interval) => !interval.start || !interval.end || interval.start >= interval.end),
    ) || scheduleExceptions.some((exception) =>
      exception.intervals.some((interval) => !interval.start || !interval.end || interval.start >= interval.end),
    );
    if (incompleteEnabledDay || invalidInterval) {
      toast({
        title: "Revise a grade semanal",
        description: incompleteEnabledDay
          ? "Adicione ao menos um turno para cada dia marcado como atendimento."
          : "Confira se o fim de cada turno é posterior ao início.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      ...data,
      specialty: data.specialty || "",
      phone: data.phone || "",
      email: data.email || "",
      weeklySchedule,
      scheduleExceptions,
    };

    if (professional) {
      updateMutation.mutate({ id: professional.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["listAppointments"] });
          toast({ title: "Profissional atualizado com sucesso" });
          onOpenChange(false);
        },
        onError: (error) => toast({
          title: "Não foi possível salvar a grade",
          description: error instanceof Error ? error.message : "Confira os horários e tente novamente.",
          variant: "destructive",
        }),
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
          toast({ title: "Profissional criado com sucesso" });
          onOpenChange(false);
        },
        onError: (error) => toast({
          title: "Não foi possível cadastrar o profissional",
          description: error instanceof Error ? error.message : "Confira os dados e horários e tente novamente.",
          variant: "destructive",
        }),
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden bg-surface border-border">
        <DialogHeader>
          <DialogTitle>{professional ? "Editar Profissional" : "Novo Profissional"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="max-h-[calc(90vh-5rem)] space-y-4 overflow-y-auto pr-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Ana Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Massoterapeuta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="commissionRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão Padrão (%)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" max="100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: ana@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ProfessionalAvailabilityEditor
              weeklySchedule={weeklySchedule}
              onWeeklyScheduleChange={setWeeklySchedule}
              scheduleExceptions={scheduleExceptions}
              onScheduleExceptionsChange={setScheduleExceptions}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3 shadow-sm bg-background">
                  <div className="space-y-0.5">
                    <FormLabel>Status do Profissional</FormLabel>
                    <div className="text-xs text-text-secondary">
                      Permite agendamentos e comissões
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {professional ? "Salvar profissional e grade" : "Criar profissional e grade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
