export const WHATSAPP_AUDIO_MESSAGE_LABELS = {
  combos: "Áudio pré-gravado enviado: explicação dos combos",
  bronze: "Áudio pré-gravado enviado: informações sobre bronzeamento",
} as const;

export const resolveRequestedWhatsappAudioClip = (
  requestedClip: "combos" | "bronze" | null | undefined,
  inferredClip: "combos" | "bronze" | null,
): "combos" | "bronze" | null =>
  requestedClip ?? (inferredClip === "combos" ? inferredClip : null);

export const shouldSendWhatsappAudioClip = (
  selectedForCurrentTurn: boolean,
  alreadyAttempted: boolean,
) => selectedForCurrentTurn && !alreadyAttempted;

export const shouldSendBronzeAudio = (
  selectedForCurrentTurn: boolean,
  alreadyAttempted: boolean,
  pregnancyMentioned = false,
) => selectedForCurrentTurn && !alreadyAttempted && !pregnancyMentioned;

export const bronzeMethodDifferenceReply =
  "O bronze natural é por ordem de chegada até 11h30; o bronze em máquina também é por ordem de chegada, até 20h de segunda a sexta e 18h aos sábados. A equipe pode confirmar contraindicações conforme cada caso. 🤎";

export const bronzeAudioUnavailableReply =
  "Não consegui enviar o áudio agora. O bronze natural é por ordem de chegada até 11h30; o bronze em máquina, até 20h de segunda a sexta e 18h aos sábados. A equipe pode confirmar contraindicações conforme cada caso. 🤎";

export const bronzeNeonRecommendationReply =
  "Temos opções de bronze a partir de R$ 150. O Protocolo Neon reúne 3 sessões + esfoliação por R$ 180 e foi pensado para um tom dourado de aparência natural, acabamento mais uniforme e marquinhas personalizadas; o procedimento é rápido e, com os cuidados adequados, a pele pode parecer mais iluminada. Quer que eu te explique como funciona? 🤎";