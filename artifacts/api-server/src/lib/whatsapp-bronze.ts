export const WHATSAPP_AUDIO_MESSAGE_LABELS = {
  combos: "Áudio pré-gravado enviado: explicação dos combos",
  bronze: "Áudio pré-gravado enviado: informações sobre bronzeamento",
} as const;

export const shouldSendBronzeAudio = (
  asksAboutBronze: boolean,
  alreadyDelivered: boolean,
  pregnancyMentioned = false,
) => asksAboutBronze && !alreadyDelivered && !pregnancyMentioned;

export const bronzeMethodDifferenceReply =
  "O bronze natural é feito com exposição ao sol. A máquina usa a WB Ultra, com 72 lâmpadas e exposição de cerca de 8 a 20 minutos conforme o fototipo, em atendimento individualizado. 🤎";

export const bronzeAudioUnavailableReply =
  "Não consegui enviar o áudio agora, mas o bronze natural é feito com exposição ao sol. A máquina usa a WB Ultra, com 72 lâmpadas e exposição de cerca de 8 a 20 minutos conforme o fototipo, em atendimento individualizado. 🤎";