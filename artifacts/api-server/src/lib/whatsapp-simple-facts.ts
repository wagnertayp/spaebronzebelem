export type WhatsappSimpleFactService = {
  name: string;
  price: string;
};

export type WhatsappSimpleFactReply = {
  intent: "hours" | "address" | "price";
  reply: string;
};

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const addressIsOnlyCityAndState = (address: string) =>
  /^belem(?:\s*[-,]\s*(?:pa|para))?$/.test(normalize(address));

export const getWhatsappSimpleFactReply = (input: {
  text: string;
  businessHours: string;
  address: string;
  mentionedService: WhatsappSimpleFactService | null;
}): WhatsappSimpleFactReply | null => {
  const text = normalize(input.text);
  if (
    !text ||
    /\b(?:agendar|agendamento|marcar|reserva|cancelar|disponibilidade|horario livre|vaga|gravida|gravidez|gestante|alergia|reacao|dor|medicamento|doenca|reclam|problema|errado|cobranca|cobrou)\b/.test(
      text,
    )
  ) {
    return null;
  }

  const asksHours = /\b(?:horario|horarios|que horas|abre|aberto|fecha|funcionamento)\b/.test(text);
  const asksAddress = /\b(?:endereco|localizacao|onde fica|como chegar)\b/.test(text);
  const asksPrice = /\b(?:preco|valor|quanto custa|custa)\b/.test(text);
  const intents = [asksHours, asksAddress, asksPrice].filter(Boolean).length;
  if (intents !== 1) return null;

  if (asksHours) {
    if (
      input.mentionedService ||
      !input.businessHours.trim() ||
      /\b(?:aberto agora|esta aberto|ta aberto)\b/.test(text)
    ) {
      return null;
    }
    return {
      intent: "hours",
      reply: `Nosso horário de funcionamento é:\n${input.businessHours.trim()} 🤎`,
    };
  }

  if (asksAddress) {
    const address = input.address.trim();
    if (!address || addressIsOnlyCityAndState(address)) return null;
    return {
      intent: "address",
      reply: `O endereço do Spa é ${address}. 🤎`,
    };
  }

  const service = input.mentionedService;
  if (!service || !service.name.trim() || !/\bR\$\s*\d/i.test(service.price)) {
    return null;
  }
  return {
    intent: "price",
    reply: `O valor cadastrado para ${service.name} é ${service.price.trim()}. 🤎`,
  };
};
