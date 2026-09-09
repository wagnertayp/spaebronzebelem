import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "spa_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const USERNAME = "123kali";
const PASSWORD_SALT = "spa-bronze-login-v1";
const PASSWORD_DIGEST = Buffer.from(
  "53a2b218dfc01ad4a6ef776513a2dbc78be548950ebdc062c727fd2d284a2acd",
  "hex",
);

const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return secret;
};
const encode = (value: string) => Buffer.from(value).toString("base64url");

export type Session = { username: string; exp: number };

export function createSession(username: string) {
  const payload: Session = { username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    return session.username === USERNAME && session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

export function verifyCredentials(username: unknown, password: unknown) {
  if (typeof username !== "string" || typeof password !== "string" || username !== USERNAME) return false;
  const digest = scryptSync(password, PASSWORD_SALT, 32);
  return timingSafeEqual(PASSWORD_DIGEST, digest);
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", path: "/" });
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req.cookies?.[COOKIE_NAME]);
  if (!session) return res.status(401).json({ error: "Não autenticado" });
  res.locals.session = session;
  return next();
}

export { COOKIE_NAME };