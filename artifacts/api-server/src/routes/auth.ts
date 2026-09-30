import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffAccessAccountsTable } from "@workspace/db";
import {
  ChangeStaffPasswordBody,
  ChangeStaffPasswordResponse,
  GetAuthSessionResponse,
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import {
  clearSessionCookie,
  createSession,
  createPasswordRecord,
  publicAuthUser,
  resolveSession,
  getAdminUsername,
  setSessionCookie,
  verifyCredentials,
  verifyPassword,
  COOKIE_NAME,
} from "../lib/auth";
import { preventAuthenticationResponseCaching } from "../lib/auth-cache";

const router: IRouter = Router();

router.use(preventAuthenticationResponseCaching);

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const username = parsed.data.username.trim();
  const password = parsed.data.password;
  if (verifyCredentials(username, password)) {
    const token = createSession({ username: getAdminUsername(), role: "admin" });
    setSessionCookie(res, token);
    const session = await resolveSession(token);
    if (!session) {
      clearSessionCookie(res);
      res.status(401).json({ error: "Não foi possível iniciar a sessão." });
      return;
    }
    res.json(LoginResponse.parse({ user: publicAuthUser(session) }));
    return;
  }

  const normalizedUsername = username.toLocaleLowerCase("en-US");
  const [account] = normalizedUsername
    ? await db
        .select()
        .from(staffAccessAccountsTable)
        .where(eq(staffAccessAccountsTable.username, normalizedUsername))
        .limit(1)
    : [];
  if (!account || !account.active || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    res.status(401).json({ error: "Usuário ou senha inválidos" });
    return;
  }

  const token = createSession({
    username: account.username,
    role: "staff",
    userId: account.id,
    sessionVersion: account.sessionVersion,
  });
  setSessionCookie(res, token);
  const session = await resolveSession(token);
  if (!session) {
    clearSessionCookie(res);
    res.status(401).json({ error: "Esta conta não está mais ativa." });
    return;
  }
  res.json(LoginResponse.parse({ user: publicAuthUser(session) }));
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const session = await resolveSession(req.cookies?.[COOKIE_NAME]);
  if (!session) {
    res.json(GetAuthSessionResponse.parse({ user: null }));
    return;
  }
  res.json(GetAuthSessionResponse.parse({
    user: publicAuthUser(session),
    expiresAt: new Date(session.exp * 1000).toISOString(),
  }));
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const session = await resolveSession(req.cookies?.[COOKIE_NAME]);
  if (!session || session.role !== "staff" || session.userId == null) {
    res.status(session ? 403 : 401).json({ error: "Não autorizado" });
    return;
  }

  const parsed = ChangeStaffPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;

  const [account] = await db
    .select()
    .from(staffAccessAccountsTable)
    .where(eq(staffAccessAccountsTable.id, session.userId))
    .limit(1);
  if (
    !account ||
    !verifyPassword(currentPassword, account.passwordSalt, account.passwordHash)
  ) {
    res.status(401).json({ error: "A senha atual está incorreta." });
    return;
  }

  const passwordRecord = createPasswordRecord(newPassword);
  const [updated] = await db
    .update(staffAccessAccountsTable)
    .set({
      ...passwordRecord,
      mustChangePassword: false,
      sessionVersion: account.sessionVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(staffAccessAccountsTable.id, account.id))
    .returning();
  if (!updated) {
    res.status(401).json({ error: "A conta não está mais ativa." });
    return;
  }

  const token = createSession({
    username: updated.username,
    role: "staff",
    userId: updated.id,
    sessionVersion: updated.sessionVersion,
  });
  setSessionCookie(res, token);
  const updatedSession = await resolveSession(token);
  if (!updatedSession) {
    clearSessionCookie(res);
    res.status(401).json({ error: "A conta não está mais ativa." });
    return;
  }
  res.json(ChangeStaffPasswordResponse.parse({ user: publicAuthUser(updatedSession) }));
});

export default router;