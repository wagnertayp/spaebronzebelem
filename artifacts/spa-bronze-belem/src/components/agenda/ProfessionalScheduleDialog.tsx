import { useEffect, useState } from "react";
import {
  getListAppointmentsQueryKey,
  getListProfessionalsQueryKey,
  useUpdateProfessional,
} from "@workspace/api-client-react";
import type {
  Professional,
  ProfessionalScheduleException,
  WeeklyScheduleDay,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  createEmptyWeeklySchedule,
  ProfessionalAvailabilityEditor,
} from "@/components/commissions/ProfessionalAvailabilityEditor";

type ProfessionalScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: Professional[];
};

export function ProfessionalScheduleDialog({
  open,
  onOpenChange,
  professionals,
}: ProfessionalScheduleDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateProfessional();
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleDay[]>(createEmptyWeeklySchedule());
  const [scheduleExceptions, setScheduleExceptions] = useState<ProfessionalScheduleException[]>([]);
  const selectedProfessional = professionals.find((professional) => professional.id === professionalId);

  useEffect(() => {
    if (!open) return;
    const initialProfessional = professionals.find((professional) => professional.id === professionalId)
      ?? professionals[0];
    if (!initialProfessional) return;
    setProfessionalId(initialProfessional.id);
    setWeeklySchedule(initialProfessional.weeklySchedule);
    setScheduleExceptions(initialProfessional.scheduleExceptions);
  }, [open, professionalId, professionals]);

  const saveSchedule = () => {
    if (!selectedProfessional) return;
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

    updateMutation.mutate({
      id: selectedProfessional.id,
      data: {
        name: selectedProfessional.name,
        specialty: selectedProfessional.specialty,
        phone: selectedProfessional.phone,
        email: selectedProfessional.email,
        commissionRate: selectedProfessional.commissionRate,
        active: selectedProfessional.active,
        weeklySchedule,
        scheduleExceptions,
      },
    }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        toast({ title: `Grade de ${selectedProfessional.name} atualizada` });
        onOpenChange(false);
      },
      onError: () => toast({
        title: "Não foi possível atualizar a grade",
        description: "Confira os horários e tente novamente.",
        variant: "destructive",
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden bg-surface">
        <DialogHeader>
          <DialogTitle>Grade semanal dos profissionais</DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(90vh-10rem)] space-y-4 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-professional">Profissional</Label>
            <select
              id="schedule-professional"
              value={professionalId ?? ""}
              onChange={(event) => setProfessionalId(Number(event.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={professionals.length === 0}
            >
              {professionals.length === 0 && <option value="">Nenhum profissional ativo</option>}
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>{professional.name}</option>
              ))}
            </select>
          </div>

          {selectedProfessional ? (
            <ProfessionalAvailabilityEditor
              weeklySchedule={weeklySchedule}
              onWeeklyScheduleChange={setWeeklySchedule}
              scheduleExceptions={scheduleExceptions}
              onScheduleExceptionsChange={setScheduleExceptions}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">
              Cadastre um profissional ativo para configurar a grade.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            Fechar
          </Button>
          <Button type="button" onClick={saveSchedule} disabled={!selectedProfessional || updateMutation.isPending}>
            {updateMutation.isPending ? "Salvando..." : "Atualizar grade semanal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}