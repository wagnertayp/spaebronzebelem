export const WHATSAPP_AUDIO_MESSAGE_LABELS = {
  combos: "Áudio pré-gravado enviado: explicação dos combos",
  bronze: "Áudio pré-gravado enviado: informações sobre bronzeamento",
} as const;

export const resolveRequestedWhatsappAudioClip = (
  requestedClip: "combos" | "bronze" | null | undefined,
  inferredClip: "combos" | "bronze" | null,
): "combos" | "bronze" | null =>
  requestedClip ?? (inferredClip === "combos" ? inferredClip : null);

export const shouldSendBronzeAudio = (
  selectedForCurrentTurn: boolean,
  alreadyAttempted: boolean,
  pregnancyMentioned = false,
) => selectedForCurrentTurn && !alreadyAttempted && !pregnancyMentioned;

export const bronzeMethodDifferenceReply =
  "O bronze natural é feito com exposição solar. Na máquina, o atendimento usa a WB Ultra, com 72 lâmpadas e exposição aproximada de 8 a 20 minutos conforme o fototipo, de forma individualizada. 🤎";

export const bronzeAudioUnavailableReply =
  "Não consegui enviar o áudio agora, mas o bronze natural é feito com exposição solar. Na máquina, o atendimento usa a WB Ultra, com 72 lâmpadas e exposição aproximada de 8 a 20 minutos conforme o fototipo, de forma individualizada. 🤎";