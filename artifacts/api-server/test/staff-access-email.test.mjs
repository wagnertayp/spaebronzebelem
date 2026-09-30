import assert from "node:assert/strict";
import { test } from "node:test";
import { sendStaffAccessCredentialsEmail } from "../src/lib/resend-email.ts";

const input = {
  email: "marina@example.com",
  professionalName: "Marina Silva",
  username: "marina.silva",
  temporaryPassword: "marina",
};

test("sends initial credentials and first-login instructions through Resend", async () => {
  let request;
  const result = await sendStaffAccessCredentialsEmail(
    input,
    {
      apiKey: "test-api-key",
      from: "Spa e Bronze Belém <acesso@example.com>",
      loginUrl: "https://spa.example.com",
    },
    async (url, options) => {
      request = { url, options };
      return new Response(null, { status: 200 });
    },
  );

  assert.deepEqual(result, { sent: true });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.headers.Authorization, "Bearer test-api-key");
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(payload.to, ["marina@example.com"]);
  assert.equal(payload.from, "Spa e Bronze Belém <acesso@example.com>");
  assert.match(payload.text, /Usuário: marina\.silva/);
  assert.match(payload.text, /Senha inicial: marina/);
  assert.match(payload.text, /solicitará que você crie uma nova senha/);
  assert.match(payload.text, /https:\/\/spa\.example\.com\/login/);
  assert.match(payload.html, /<a href="https:\/\/spa\.example\.com\/login"/);
  assert.match(
    payload.html,
    /<img src="https:\/\/i\.ibb\.co\/qLwmTsFG\/2a87de2a-dbde-443e-b771-0a6585ebcc85-removalai-preview\.png"/,
  );
  assert.match(payload.html, /Logotipo Spa e Bronze Belém/);
  assert.equal(payload.attachments, undefined);
});

test("escapes personalized values in the branded HTML template", async () => {
  let request;
  await sendStaffAccessCredentialsEmail(
    {
      ...input,
      professionalName: "<Ana & Paulo>",
      username: "user<name",
      temporaryPassword: "a&b<",
    },
    {
      apiKey: "test-api-key",
      from: "acesso@example.com",
      loginUrl: "https://spa.example.com/login",
    },
    async (_url, options) => {
      request = { options };
      return new Response(null, { status: 200 });
    },
  );

  const payload = JSON.parse(request.options.body);
  assert.match(payload.html, /Olá, &lt;Ana &amp; Paulo&gt;!/);
  assert.match(payload.html, /user&lt;name/);
  assert.match(payload.html, /a&amp;b&lt;/);
});

test("reports missing Resend configuration without making a request", async () => {
  let requestMade = false;
  const result = await sendStaffAccessCredentialsEmail(
    input,
    { apiKey: "test-api-key", from: undefined, loginUrl: undefined },
    async () => {
      requestMade = true;
      return new Response(null, { status: 200 });
    },
  );

  assert.deepEqual(result, { sent: false, reason: "not_configured" });
  assert.equal(requestMade, false);
});

test("does not send credentials when the login URL is missing or insecure", async () => {
  let requestMade = false;
  for (const loginUrl of [undefined, "http://spa.example.com"]) {
    const result = await sendStaffAccessCredentialsEmail(
      input,
      { apiKey: "test-api-key", from: "acesso@example.com", loginUrl },
      async () => {
        requestMade = true;
        return new Response(null, { status: 200 });
      },
    );

    assert.deepEqual(result, { sent: false, reason: "not_configured" });
  }
  assert.equal(requestMade, false);
});

test("can send the branded email without a login button when explicitly requested", async () => {
  let request;
  const result = await sendStaffAccessCredentialsEmail(
    { ...input, includeLoginLink: false },
    { apiKey: "test-api-key", from: "acesso@example.com", loginUrl: undefined },
    async (_url, options) => {
      request = { options };
      return new Response(null, { status: 200 });
    },
  );

  assert.deepEqual(result, { sent: true });
  const payload = JSON.parse(request.options.body);
  assert.doesNotMatch(payload.html, /<a\s/i);
  assert.match(payload.html, /src="https:\/\/i\.ibb\.co\/qLwmTsFG/);
  assert.match(payload.text, /obter o endereço de acesso/);
  assert.equal(payload.attachments, undefined);
});

test("reports provider and network failures without exposing response details", async () => {
  const rejected = await sendStaffAccessCredentialsEmail(
    input,
    { apiKey: "test-api-key", from: "acesso@example.com", loginUrl: "https://spa.example.com/login" },
    async () => new Response("private provider details", { status: 401 }),
  );
  const networkFailure = await sendStaffAccessCredentialsEmail(
    input,
    { apiKey: "test-api-key", from: "acesso@example.com", loginUrl: "https://spa.example.com/login" },
    async () => {
      throw new Error("network failure");
    },
  );

  assert.deepEqual(rejected, { sent: false, reason: "provider_rejected" });
  assert.deepEqual(networkFailure, { sent: false, reason: "network_error" });
});