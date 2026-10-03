import type { WhatsappBookingDraft } from "@workspace/db";

export type WhatsappBookingUpdate = {
  service: string | null;
  date: string | null;
  time: string | null;
  professional: string | null;
  wantsBooking: boolean;
  cancelled: boolean;
};

export type WhatsappBookingMessageSignals = {
  date: string | null;
  time: string | null;
  affirmative: boolean;
  negative: boolean;
  cancelled: boolean;
};

export type WhatsappScheduleInterval = {
  start: string;
  end: string;
};

export const hasWhatsappBookingIntent = (value: string) =>
  /\b(?:agendar?|agendamento|marcar|reservar?|reserva|horarios?|disponibilidade|vagas?)\b/.test(
    normalizeText(value),
  );

export const formatWhatsappBookingSlotChoices = (
  slots: Array<{ time: string; professional?: string }>,
  formatTime: (time: string) => string,
) => {
  return [...new Set(slots.map((slot) => formatTime(slot.time)))].join(", ");
};

const normalizeText = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

const isValidLocalDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const shiftLocalDate = (value: string, days: number) => {
  if (!isValidLocalDate(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const normalizeLocalBookingDate = (value: string | null | undefined, today: string) => {
  if (!value) return null;
  const raw = value.trim();
  if (isValidLocalDate(raw)) return raw;

  const normalized = normalizeText(raw);
  if (/\bdepois de amanha\b/.test(normalized)) return shiftLocalDate(today, 2);
  if (/\bamanha\b/.test(normalized)) return shiftLocalDate(today, 1);
  if (/\bhoje\b/.test(normalized)) return isValidLocalDate(today) ? today : null;

  const weekdayIndex = new Map([
    ["domingo", 0],
    ["segunda", 1],
    ["segunda-feira", 1],
    ["terca", 2],
    ["terca-feira", 2],
    ["quarta", 3],
    ["quarta-feira", 3],
    ["quinta", 4],
    ["quinta-feira", 4],
    ["sexta", 5],
    ["sexta-feira", 5],
    ["sabado", 6],
    ["sabado-feira", 6],
  ]);
  const weekdayEntry = [...weekdayIndex.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([name]) => new RegExp(`\\b${name}\\b`).test(normalized));
  if (weekdayEntry && isValidLocalDate(today)) {
    const currentWeekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    let offset = (weekdayEntry[1] - currentWeekday + 7) % 7;
    if (offset === 0 && /\b(proxima|que vem|seguinte)\b/.test(normalized)) offset = 7;
    return shiftLocalDate(today, offset);
  }

  const numericDate = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
  if (numericDate && isValidLocalDate(today)) {
    const day = Number(numericDate[1]);
    const month = Number(numericDate[2]);
    const todayYear = Number(today.slice(0, 4));
    let year = numericDate[3] ? Number(numericDate[3]) : todayYear;
    const candidate = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    if (!isValidLocalDate(candidate)) return null;
    if (!numericDate[3] && candidate < today) year += 1;
    const result = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    return isValidLocalDate(result) ? result : null;
  }
  return null;
};

export const normalizeLocalBookingTime = (value: string | null | undefined) => {
  if (!value) return null;
  const normalized = normalizeText(value);
  if (/\bmeio[- ]dia\b/.test(normalized)) return "12:00";
  if (/\bmeia[- ]noite\b/.test(normalized)) return "00:00";

  const exact = normalized.match(
    /^(?:as\s*)?([01]?\d|2[0-3])(?::([0-5]\d)|h\s*([0-5]\d)?)?\s*(?:horas?)?$/,
  );
  const explicit = exact ?? normalized.match(
    /\bas\s*([01]?\d|2[0-3])(?::([0-5]\d)|h\s*([0-5]\d)?)?\b|\b([01]?\d|2[0-3])h\s*([0-5]\d)?\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/,
  );
  if (!explicit) return null;
  const hour = Number(explicit[1] ?? explicit[4] ?? explicit[6]);
  const minute = Number(explicit[2] ?? explicit[3] ?? explicit[5] ?? explicit[7] ?? "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

export const bookingFitsScheduleIntervals = (
  localStart: string,
  localEnd: string,
  intervals: WhatsappScheduleInterval[],
) => {
  const start = localStart.match(/^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d)$/);
  const end = localEnd.match(/^(\d{4}-\d{2}-\d{2})T((?:[01]\d|2[0-3]):[0-5]\d)$/);
  if (!start || !end || start[1] !== end[1] || end[2]! <= start[2]!) return false;
  return intervals.some((interval) =>
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.start) &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.end) &&
    interval.start <= start[2]! &&
    interval.end >= end[2]!,
  );
};

export const getWhatsappBookingMessageSignals = (
  text: string,
  today: string,
): WhatsappBookingMessageSignals => {
  const normalized = normalizeText(text);
  return {
    date: normalizeLocalBookingDate(text, today),
    time: normalizeLocalBookingTime(text),
    affirmative: /^(?:sim|confirmo|confirmado|tudo certo|tudo sim|isso|isso mesmo|pode reservar|pode confirmar|ok|okay|perfeito)(?:$|[,.!\s])/.test(normalized),
    negative: /^(?:nao|nao quero|prefiro nao|nao confirmo|nao precisa)[.! ]*$/.test(normalized),
    cancelled: /\b(?:desisti|nao quero mais|pode cancelar (?:o )?agendamento|cancela (?:esse )?(?:agendamento|reserva)|parar o agendamento)\b/.test(normalized),
  };
};

export const mergeWhatsappBookingDraft = (
  previous: WhatsappBookingDraft | null,
  update: WhatsappBookingUpdate,
  currentText: string,
  textSignals: WhatsappBookingMessageSignals,
  today: string,
  resolveService: (value: string) => string | null,
): WhatsappBookingDraft | null => {
  if (update.cancelled || textSignals.cancelled) return null;

  const sourceService = update.service ?? currentText;
  const nextService = resolveService(currentText) ??
    (sourceService ? resolveService(sourceService) : null);
  const date = textSignals.date ?? normalizeLocalBookingDate(update.date, today);
  const nextDate = date ?? previous?.date ?? null;
  const serviceChanged = Boolean(
    nextService &&
    previous?.service &&
    nextService.toLocaleLowerCase("pt-BR") !== previous.service.toLocaleLowerCase("pt-BR"),
  );
  const dateChanged = Boolean(nextDate && previous?.date && nextDate !== previous.date);
  const declinedConfirmation = Boolean(previous?.awaitingConfirmation && textSignals.negative);
  const nextTime = declinedConfirmation
    ? null
    : textSignals.time ??
      normalizeLocalBookingTime(update.time) ??
      (serviceChanged || dateChanged ? null : previous?.time ?? null);
  const nextProfessional = declinedConfirmation
    ? null
    : update.professional?.trim() ||
      (serviceChanged || dateChanged ? null : previous?.professional ?? null);
  const choosingPreviouslyOfferedSlot = Boolean(previous?.awaitingSlotChoice && textSignals.time);

  return {
    service: nextService ?? previous?.service ?? null,
    date: nextDate,
    time: nextTime,
    professional: nextProfessional,
    wantsBooking: Boolean(
      (!declinedConfirmation && previous?.wantsBooking) ||
      update.wantsBooking ||
      choosingPreviouslyOfferedSlot ||
      (previous?.awaitingConfirmation && textSignals.affirmative),
    ),
    awaitingSlotChoice: declinedConfirmation
      ? false
      : serviceChanged || dateChanged
      ? false
      : Boolean(previous?.awaitingSlotChoice && !textSignals.time),
    awaitingConfirmation: declinedConfirmation || serviceChanged || dateChanged || textSignals.affirmative
      ? false
      : Boolean(previous?.awaitingConfirmation),
    awaitingClientName: Boolean(previous?.awaitingClientName),
  };
};