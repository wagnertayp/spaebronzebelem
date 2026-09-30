type StaffAccessEmailInput = {
  email: string;
  professionalName: string;
  username: string;
  temporaryPassword: string;
};

type ResendEmailConfig = {
  apiKey: string | undefined;
  from: string | undefined;
  loginUrl: string | undefined;
};

type EmailDeliveryResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_rejected" | "network_error" };

const resendConfigFromEnvironment = (): ResendEmailConfig => ({
  apiKey: process.env["RESEND_API_KEY"],
  from: process.env["RESEND_FROM_EMAIL"],
  loginUrl: process.env["SPA_LOGIN_URL"],
});

export async function sendStaffAccessCredentialsEmail(
  input: StaffAccessEmailInput,
  config: ResendEmailConfig = resendConfigFromEnvironment(),
  fetcher: typeof fetch = fetch,
): Promise<EmailDeliveryResult> {
  const apiKey = config.apiKey?.trim();
  const from = config.from?.trim();
  if (!apiKey || !from) return { sent: false, reason: "not_configured" };

  const loginUrl = config.loginUrl?.trim();
  const signInInstruction = loginUrl
    ? `Acesse o sistema por este endereço: ${loginUrl}`
    : "Acesse o sistema pelo endereço compartilhado pela administração.";
  const text = [
    `Olá, ${input.professionalName}!`,
    "",
    "Seu acesso ao sistema Spa e Bronze Belém foi criado.",
    "",
    `Usuário: ${input.username}`,
    `Senha inicial: ${input.temporaryPassword}`,
    "",
    "No primeiro acesso, o sistema solicitará que você crie uma nova senha.",
    signInInstruction,
    "",
    "Se precisar de ajuda, fale com a administração.",
  ].join("\n");

  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: "Seu acesso ao Spa e Bronze Belém",
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { sent: false, reason: "provider_rejected" };
    return { sent: true };
  } catch {
    return { sent: false, reason: "network_error" };
  }
}