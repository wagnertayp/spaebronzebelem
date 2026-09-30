type StaffAccessEmailInput = {
  email: string;
  professionalName: string;
  username: string;
  temporaryPassword: string;
  includeLoginLink?: boolean;
};

type ResendEmailConfig = {
  apiKey: string | undefined;
  from: string | undefined;
  loginUrl: string | undefined;
};

type EmailDeliveryResult =
  | { sent: true }
  | {
      sent: false;
      reason: "not_configured" | "provider_rejected" | "network_error";
    };

const EMAIL_LOGO_URL =
  "https://i.ibb.co/qLwmTsFG/2a87de2a-dbde-443e-b771-0a6585ebcc85-removalai-preview.png";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);

const normalizeLoginUrl = (value: string | undefined) => {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const appPath = url.pathname.replace(/\/+$/u, "").replace(/\/login$/iu, "");
    url.pathname = `${appPath}/login`;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
};

const renderStaffAccessEmail = ({
  professionalName,
  username,
  temporaryPassword,
  loginUrl,
  logoUrl,
}: StaffAccessEmailInput & { loginUrl: string | null; logoUrl: string }) => {
  const safeName = escapeHtml(professionalName);
  const safeUsername = escapeHtml(username);
  const safePassword = escapeHtml(temporaryPassword);
  const loginSection = loginUrl
    ? `<tr>
        <td align="center" style="padding:22px 32px 12px;">
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:15px 28px;border-radius:9px;background-color:#8c552c;color:#ffffff;font-size:16px;font-weight:700;line-height:20px;text-decoration:none;">Acessar o sistema</a>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:22px 32px 12px;color:#6e6258;font-size:14px;line-height:1.65;">
          Para obter o endereço de acesso ao sistema, fale com a administração do spa.
        </td>
      </tr>`;
  const accessInstruction = loginUrl
    ? `Acesse o sistema: ${loginUrl}`
    : "Para obter o endereço de acesso, fale com a administração do spa.";

  const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Seu acesso ao Spa e Bronze Belém</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f0e9;font-family:Arial,Helvetica,sans-serif;color:#332a23;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Seu acesso ao Spa e Bronze Belém está pronto.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f0e9;">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #eadfd2;border-radius:18px;overflow:hidden;">
            <tr>
              <td align="center" style="padding:30px 28px 22px;background-color:#fffaf4;">
                <img src="${escapeHtml(logoUrl)}" width="96" alt="Logotipo Spa e Bronze Belém" style="display:block;width:96px;max-width:100%;height:auto;border:0;">
                <p style="margin:14px 0 0;color:#8c552c;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Spa e Bronze Belém</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 12px;">
                <p style="margin:0 0 8px;color:#6e6258;font-size:16px;">Olá, ${safeName}!</p>
                <h1 style="margin:0;color:#332a23;font-size:26px;line-height:1.25;">Seu acesso está pronto</h1>
                <p style="margin:14px 0 0;color:#6e6258;font-size:15px;line-height:1.65;">A administração criou seu acesso ao sistema Spa e Bronze Belém. Use os dados abaixo para entrar pela primeira vez.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 8px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fbf7f2;border:1px solid #eee2d5;border-radius:12px;">
                  <tr>
                    <td style="padding:15px 18px 8px;color:#847568;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Usuário</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 15px;color:#332a23;font-size:16px;font-weight:700;">${safeUsername}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 18px 8px;border-top:1px solid #eee2d5;color:#847568;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Senha inicial</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 15px;color:#332a23;font-size:16px;font-weight:700;word-break:break-all;">${safePassword}</td>
                  </tr>
                </table>
              </td>
            </tr>
            ${loginSection}
            <tr>
              <td style="padding:12px 32px 30px;color:#6e6258;font-size:14px;line-height:1.65;">
                <p style="margin:0 0 10px;"><strong>Por segurança, você deverá criar uma nova senha no primeiro acesso.</strong></p>
                <p style="margin:0;">Se precisar de ajuda, fale com a administração do spa.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:16px 24px;background-color:#f9f5f0;color:#918477;font-size:12px;line-height:1.5;">Spa e Bronze Belém · Acesso profissional</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Olá, ${professionalName}!`,
    "",
    "Seu acesso ao sistema Spa e Bronze Belém está pronto.",
    "",
    `Usuário: ${username}`,
    `Senha inicial: ${temporaryPassword}`,
    "",
    "No primeiro acesso, o sistema solicitará que você crie uma nova senha.",
    accessInstruction,
    "",
    "Se precisar de ajuda, fale com a administração do spa.",
  ].join("\n");

  return { html, text };
};

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
  const loginUrl = normalizeLoginUrl(config.loginUrl);
  const shouldIncludeLoginLink = input.includeLoginLink !== false;
  if (!apiKey || !from || (shouldIncludeLoginLink && !loginUrl)) {
    return { sent: false, reason: "not_configured" };
  }
  const content = renderStaffAccessEmail({
    ...input,
    loginUrl: loginUrl?.toString() ?? null,
    logoUrl: EMAIL_LOGO_URL,
  });

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
        text: content.text,
        html: content.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { sent: false, reason: "provider_rejected" };
    return { sent: true };
  } catch {
    return { sent: false, reason: "network_error" };
  }
}