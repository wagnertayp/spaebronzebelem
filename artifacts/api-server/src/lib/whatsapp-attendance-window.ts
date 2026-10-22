export const WHATSAPP_ATTENDANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

type TimestampedMessage = { createdAt: Date | string };

const toTimestamp = (value: Date | string) => {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Invalid WhatsApp message timestamp");
  }
  return timestamp;
};

export const getWhatsappAttendanceWindow = <T extends TimestampedMessage>(
  messages: readonly T[],
  referenceAt?: Date | string,
) => {
  if (messages.length === 0) return [];

  let laterTimestamp = toTimestamp(
    referenceAt ?? messages[messages.length - 1]!.createdAt,
  );
  let firstInWindow = messages.length;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const messageTimestamp = toTimestamp(messages[index]!.createdAt);
    if (laterTimestamp - messageTimestamp > WHATSAPP_ATTENDANCE_WINDOW_MS) {
      break;
    }
    firstInWindow = index;
    laterTimestamp = messageTimestamp;
  }

  return messages.slice(firstInWindow);
};
