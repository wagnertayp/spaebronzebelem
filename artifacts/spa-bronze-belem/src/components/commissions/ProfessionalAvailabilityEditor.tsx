import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
import type { ProfessionalScheduleException, WeeklyScheduleDay } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = [
  { weekday: 1, label: "Segunda-feira" },
  { weekday: 2, label: "Terça-feira" },
  { weekday: 3, label: "Quarta-feira" },
  { weekday: 4, label: "Quinta-feira" },
  { weekday: 5, label: "Sexta-feira" },
  { weekday: 6, label: "Sábado" },
  { weekday: 0, label: "Domingo" },
];

export const createEmptyWeeklySchedule = (): WeeklyScheduleDay[] =>
  Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: false, intervals: [] }));

type ProfessionalAvailabilityEditorProps = {
  weeklySchedule: WeeklyScheduleDay[];
  onWeeklyScheduleChange: (schedule: WeeklyScheduleDay[]) => void;
  scheduleExceptions: ProfessionalScheduleException[];
  onScheduleExceptionsChange: (exceptions: ProfessionalScheduleException[]) => void;
};

export function ProfessionalAvailabilityEditor({
  weeklySchedule,
  onWeeklyScheduleChange,
  scheduleExceptions,
  onScheduleExceptionsChange,
}: ProfessionalAvailabilityEditorProps) {
  const { toast } = useToast();
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionType, setExceptionType] = useState<ProfessionalScheduleException["type"]>("day_off");
  const [exceptionStart, setExceptionStart] = useState("09:00");
  const [exceptionEnd, setExceptionEnd] = useState("17:00");
  const [exceptionReason, setExceptionReason] = useState("");

  const updateDay = (weekday: number, update: (day: WeeklyScheduleDay) => WeeklyScheduleDay) => {
    const current = weeklySchedule.find((day) => day.weekday === weekday) ?? {
      weekday,
      enabled: false,
      intervals: [],
    };
    onWeeklyScheduleChange([
      ...weeklySchedule.filter((day) => day.weekday !== weekday),
      update(current),
    ].sort((a, b) => a.weekday - b.weekday));
  };

  const addException = () => {
    if (!exceptionDate) {
      toast({ title: "Escolha a data da exceção", variant: "destructive" });
      return;
    }
    if (
      exceptionType === "custom_hours" &&
      (!exceptionStart || !exceptionEnd || exceptionStart >= exceptionEnd)
    ) {
      toast({
        title: "Horário especial inválido",
        description: "O fim precisa ser posterior ao início.",
        variant: "destructive",
      });
      return;
    }

    const exception: ProfessionalScheduleException = {
      date: exceptionDate,
      type: exceptionType,
      intervals: exceptionType === "custom_hours"
        ? [{ start: exceptionStart, end: exceptionEnd }]
        : [],
      reason: exceptionReason.trim() || (exceptionType === "day_off" ? "Folga" : "Horário especial"),
    };
    onScheduleExceptionsChange([
      ...scheduleExceptions.filter((item) => item.date !== exceptionDate),
      exception,
    ].sort((a, b) => a.date.localeCompare(b.date)));
    setExceptionDate("");
    setExceptionReason("");
    toast({ title: "Exceção adicionada à grade" });
  };

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border border-border bg-background p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Grade semanal</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Esta grade se repete toda semana. Adicione mais de um turno para incluir intervalos.
          </p>
        </div>

        <div className="space-y-2">
          {WEEKDAYS.map(({ weekday, label }) => {
            const day = weeklySchedule.find((item) => item.weekday === weekday) ?? {
              weekday,
              enabled: false,
              intervals: [],
            };

            return (
              <div key={weekday} className="rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label className="font-medium">{label}</Label>
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span>{day.enabled ? "Atende" : "Folga"}</span>
                    <Switch
                      checked={day.enabled}
                      aria-label={`${day.enabled ? "Desativar" : "Ativar"} ${label}`}
                      onCheckedChange={(enabled) => updateDay(weekday, (current) => ({ ...current, enabled }))}
                    />
                  </div>
                </div>

                {day.enabled && (
                  <div className="mt-3 space-y-2">
                    {day.intervals.map((interval, index) => (
                      <div key={`${weekday}-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-text-secondary">Início</Label>
                          <Input
                            type="time"
                            value={interval.start}
                            aria-label={`${label}, turno ${index + 1}, início`}
                            onChange={(event) => updateDay(weekday, (current) => ({
                              ...current,
                              intervals: current.intervals.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, start: event.target.value } : item,
                              ),
                            }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-text-secondary">Fim</Label>
                          <Input
                            type="time"
                            value={interval.end}
                            aria-label={`${label}, turno ${index + 1}, fim`}
                            onChange={(event) => updateDay(weekday, (current) => ({
                              ...current,
                              intervals: current.intervals.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, end: event.target.value } : item,
                              ),
                            }))}
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Remover turno ${index + 1} de ${label}`}
                          onClick={() => updateDay(weekday, (current) => ({
                            ...current,
                            intervals: current.intervals.filter((_, itemIndex) => itemIndex !== index),
                          }))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => updateDay(weekday, (current) => ({
                        ...current,
                        intervals: [...current.intervals, { start: "09:00", end: "17:00" }],
                      }))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar turno
                    </Button>
                    {day.intervals.length === 0 && (
                      <p className="text-xs text-amber-700">Adicione um turno para liberar agendamentos neste dia.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-background p-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Exceções e folgas</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Uma exceção substitui a grade semanal apenas na data escolhida.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-exception-date">Data</Label>
            <Input
              id="schedule-exception-date"
              type="date"
              value={exceptionDate}
              onChange={(event) => setExceptionDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="schedule-exception-type">Tipo</Label>
            <select
              id="schedule-exception-type"
              value={exceptionType}
              onChange={(event) => setExceptionType(event.target.value as ProfessionalScheduleException["type"])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="day_off">Folga / indisponível</option>
              <option value="custom_hours">Horário especial</option>
            </select>
          </div>
        </div>

        {exceptionType === "custom_hours" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-exception-start">Início</Label>
              <Input
                id="schedule-exception-start"
                type="time"
                value={exceptionStart}
                onChange={(event) => setExceptionStart(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="schedule-exception-end">Fim</Label>
              <Input
                id="schedule-exception-end"
                type="time"
                value={exceptionEnd}
                onChange={(event) => setExceptionEnd(event.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="schedule-exception-reason">Motivo (opcional)</Label>
          <Input
            id="schedule-exception-reason"
            value={exceptionReason}
            placeholder={exceptionType === "day_off" ? "Ex.: folga, férias ou feriado" : "Ex.: atendimento pela manhã"}
            onChange={(event) => setExceptionReason(event.target.value)}
          />
        </div>

        <Button type="button" variant="outline" className="gap-2" onClick={addException}>
          <Plus className="h-4 w-4" />
          Adicionar exceção
        </Button>

        {scheduleExceptions.length > 0 ? (
          <ul className="space-y-2">
            {[...scheduleExceptions].sort((a, b) => a.date.localeCompare(b.date)).map((exception) => (
              <li key={exception.date} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {format(new Date(`${exception.date}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {" · "}
                    {exception.type === "day_off" ? "Folga" : "Horário especial"}
                  </p>
                  <p className="truncate text-xs text-text-secondary">
                    {exception.reason}
                    {exception.type === "custom_hours" && exception.intervals[0]
                      ? ` · ${exception.intervals[0].start}–${exception.intervals[0].end}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover exceção de ${exception.date}`}
                  onClick={() => onScheduleExceptionsChange(
                    scheduleExceptions.filter((item) => item.date !== exception.date),
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-text-muted">Nenhuma exceção cadastrada.</p>
        )}
      </section>
    </div>
  );
}