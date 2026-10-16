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

export const shouldSuggestWhatsappNeon = ({
  text,
  recentUserContext,
  flow,
  visitIntent,
  explicitInfoRequest,
  pregnancyMentioned,
}: {
  text: string;
  recentUserContext: string;
  flow: "natural" | "machine" | "unspecified" | null;
  visitIntent: boolean;
  explicitInfoRequest: boolean;
  pregnancyMentioned: boolean;
}) => {
  const normalizedText = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const recent = recentUserContext.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const conversation = `${recent}\n${normalizedText}`;
  const neonWasDeclined = /\b(?:nao|dispenso)\b.{0,40}\bneon\b/.test(normalizedText);
  const anotherPackageWasChosen =
    /\b(?:escolhi|prefiro|vou ficar com|vou de|decidi pelo|quero fazer)\b.{0,50}\b(?:glam potencia|sparkles potencia|fly gourmet|shine gourmet|flash bronze|maravilhosa basiquinha|marquinha de milhoes|brilho total|bronzeamento carioca|bronze rainha|magic bronze make|magic shine make|insta bronze make)\b/.test(conversation);

  return !pregnancyMentioned &&
    !neonWasDeclined &&
    !anotherPackageWasChosen &&
    flow !== "natural" &&
    (
      (visitIntent && flow === "unspecified") ||
      (!explicitInfoRequest &&
        /\b(?:preco|valor|quanto|opcoes?|pacotes?|recomenda|beneficios?|neon|quero fazer bronze|queria fazer bronze)\b/.test(normalizedText))
    );
};