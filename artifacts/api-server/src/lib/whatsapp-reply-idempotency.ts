export type WhatsappInboundReplyAnchor = {
  id: number;
  createdAt: Date;
};

export type WhatsappOutboundReplyCandidate = {
  id: number;
  createdAt: Date;
};

export const WHATSAPP_CUSTOMER_ANSWER_KINDS = ["reply", "handoff"] as const;

export const isWhatsappCustomerAnswerKind = (kind: string) =>
  (WHATSAPP_CUSTOMER_ANSWER_KINDS as readonly string[]).includes(kind);

export const isWhatsappReplyAfterInbound = (
  inbound: WhatsappInboundReplyAnchor,
  outbound: WhatsappOutboundReplyCandidate,
) => {
  const inboundTime = inbound.createdAt.getTime();
  const outboundTime = outbound.createdAt.getTime();
  return outboundTime > inboundTime ||
    (outboundTime === inboundTime && outbound.id > inbound.id);
};
