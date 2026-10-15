export type WhatsappWebhookAcknowledgement = {
  statusCode: 200 | 503;
  body: Record<string, unknown>;
  error?: unknown;
};

export const persistWhatsappWebhookBeforeAcknowledgement = async <Payload>({
  enqueue,
  eventKey,
  payload,
}: {
  enqueue: (eventKey: string, payload: Payload) => Promise<boolean>;
  eventKey: string;
  payload: Payload;
}): Promise<WhatsappWebhookAcknowledgement> => {
  try {
    const inserted = await enqueue(eventKey, payload);
    return {
      statusCode: 200,
      body: {
        received: true,
        action: inserted ? "queued" : "duplicate_queued",
      },
    };
  } catch (error) {
    return {
      statusCode: 503,
      body: { error: "Não foi possível registrar a mensagem para processamento." },
      error,
    };
  }
};
