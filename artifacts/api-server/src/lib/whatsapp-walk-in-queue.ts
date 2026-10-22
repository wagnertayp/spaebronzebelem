export type WhatsappWalkInQueueEntry = {
  id: number;
  clientName: string;
  phone: string;
  service: string;
  status: "waiting" | "in_service" | "completed" | "canceled";
  createdAt: string;
};

const dateKeyInZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error("Could not determine local walk-in queue date.");
  return `${year}-${month}-${day}`;
};

export const enqueueConfirmedTanningWalkIn = (
  queue: WhatsappWalkInQueueEntry[],
  input: { clientName: string; phone: string; createdAt?: Date; timeZone?: string },
) => {
  const normalizedPhone = input.phone.replace(/\D/g, "");
  if (!normalizedPhone) throw new Error("A phone number is required for the walk-in queue.");

  const createdAt = input.createdAt ?? new Date();
  const timeZone = input.timeZone ?? "America/Belem";
  const today = dateKeyInZone(createdAt, timeZone);
  const existing = queue.find((entry) => {
    const entryPhone = entry.phone.replace(/\D/g, "");
    const entryDate = dateKeyInZone(new Date(entry.createdAt), timeZone);
    return (
      entryPhone === normalizedPhone &&
      entryDate === today &&
      (entry.status === "waiting" || entry.status === "in_service")
    );
  });
  if (existing) return existing;

  const entry: WhatsappWalkInQueueEntry = {
    id: queue.reduce((largest, item) => Math.max(largest, item.id), 0) + 1,
    clientName: input.clientName.trim() || "Cliente WhatsApp",
    phone: input.phone,
    service: "Bronzeamento",
    status: "waiting",
    createdAt: createdAt.toISOString(),
  };
  queue.unshift(entry);
  return entry;
};
