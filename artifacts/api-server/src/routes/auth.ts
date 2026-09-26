import { Router, type IRouter } from "express";
import {
  clearSessionCookie,
  createSession,
  getAdminUsername,
  readSession,
  setSessionCookie,
  verifyCredentials,
  COOKIE_NAME,
} from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", (req, res) => {
  if (!verifyCredentials(req.body?.username, req.body?.password)) {
    return void res.status(401).json({ error: "Usuário ou senha inválidos" });
  }
  const username = getAdminUsername();
  const token = createSession(username);
  setSessionCookie(res, token);
  res.json({ user: { username } });
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get("/auth/session", (req, res) => {
  const session = readSession(req.cookies?.[COOKIE_NAME]);
  if (!session) return void res.json({ user: null });
  res.json({ user: { username: session.username }, expiresAt: new Date(session.exp * 1000).toISOString() });
});

export default router;