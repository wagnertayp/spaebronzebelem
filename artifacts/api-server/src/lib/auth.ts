import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, staffAccessAccountsTable } from "@workspace/db";

const COOKIE_NAME = "spa_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const isProduction = process.env["NODE_ENV"] === "production";
const configuredUsername = process.env["SPA_ADMIN_USERNAME"]?.trim();
const configuredPassword = process.env["SPA_ADMIN_PASSWORD"];
const configuredCredentialsProvided = Boolean(configuredUsername || configuredPassword);

if (configuredCredentialsProvided && (!configuredUsername || !configuredPassword)) {
  throw new Error("Configure SPA_ADMIN_USERNAME and SPA_ADMIN_PASSWORD together.");
}
if (isProduction && (!configuredUsername || !configuredPassword)) {
  throw new Error("SPA_ADMIN_USERNAME and SPA_ADMIN_PASSWORD are required in production.");
}
if (
  isProduction &&
  (!process.env["SESSION_SECRET"]?.trim() || process.env["SESSION_SECRET"].length < 32)
) {
  throw new Error("A stable SESSION_SECRET with at least 32 characters is required in production.");
}

const USERNAME = configuredUsername ?? "123kali";
const PASSWORD_SALT = configuredCredentialsProvided
  ? randomBytes(16)
  : "spa-bronze-login-v1";
const PASSWORD_DIGEST = configuredPassword
  ? scryptSync(configuredPassword, PASSWORD_SALT, 32)
  : Buffer.from(
  "53a2b218dfc01ad4a6ef776513a2dbc78be548950ebdc062c727fd2d284a2acd",
  "hex",
  );

export const getAdminUsername = () => USERNAME;

const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return secret;
};
const encode = (value: string) => Buffer.from(value).toString("base64url");

export type SessionClaims = {
  username: string;
  exp: number;
  role: "admin" | "staff";
  userId?: number;
  sessionVersion?: number;
};

export type AuthUser = {
  username: string;
  role: "admin" | "staff";
  professionalId: number | null;
  canAccessAgenda: boolean;
  canAccessCommissions: boolean;
  agendaScope: "own" | "team";
  mustChangePassword: boolean;
};

export type AuthenticatedSession = AuthUser & {
  exp: number;
  userId?: number;
  sessionVersion?: number;
};

export function createSession(
  identity: Omit<SessionClaims, "exp">,
) {
  const payload: SessionClaims = {
    ...identity,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function readSession(token: string | undefined): SessionClaims | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", getSecret()).update(body).digest();
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionClaims;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (session.role === "admin") {
      return session.username === USERNAME ? session : null;
    }
    if (
      session.role === "staff" &&
      Number.isInteger(session.userId) &&
      Number.isInteger(session.sessionVersion) &&
      typeof session.username === "string"
    ) return session;
    return null;
  } catch {
    return null;
  }
}

export function verifyCredentials(username: unknown, password: unknown) {
  if (typeof username !== "string" || typeof password !== "string" || username !== USERNAME) return false;
  const digest = scryptSync(password, PASSWORD_SALT, 32);
  return timingSafeEqual(PASSWORD_DIGEST, digest);
}

export function createPasswordRecord(password: string) {
  const salt = randomBytes(16);
  return {
    passwordSalt: salt.toString("base64url"),
    passwordHash: scryptSync(password, salt, 32).toString("hex"),
  };
}

export function verifyPassword(password: unknown, saltValue: unknown, hashValue: unknown) {
  if (
    typeof password !== "string" ||
    typeof saltValue !== "string" ||
    typeof hashValue !== "string"
  ) return false;
  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(hashValue, "hex");
    if (salt.length !== 16 || expected.length !== 32) return false;
    return timingSafeEqual(expected, scryptSync(password, salt, 32));
  } catch {
    return false;
  }
}

export const generateTemporaryPassword = () => randomBytes(18).toString("base64url");

const adminUser: AuthUser = {
  username: USERNAME,
  role: "admin",
  professionalId: null,
  canAccessAgenda: true,
  canAccessCommissions: true,
  agendaScope: "team",
  mustChangePassword: false,
};

export async function resolveSession(token: string | undefined): Promise<AuthenticatedSession | null> {
  const claims = readSession(token);
  if (!claims) return null;
  if (claims.role === "admin") return { ...adminUser, exp: claims.exp };

  const [account] = await db
    .select()
    .from(staffAccessAccountsTable)
    .where(eq(staffAccessAccountsTable.id, claims.userId!))
    .limit(1);
  if (
    !account ||
    !account.active ||
    account.username !== claims.username ||
    account.sessionVersion !== claims.sessionVersion
  ) return null;

  return {
    username: account.username,
    role: "staff",
    professionalId: account.professionalId,
    canAccessAgenda: account.canAccessAgenda,
    canAccessCommissions: account.canAccessCommissions,
    agendaScope: account.agendaScope,
    mustChangePassword: account.mustChangePassword,
    exp: claims.exp,
    userId: account.id,
    sessionVersion: account.sessionVersion,
  };
}

export function publicAuthUser(session: AuthenticatedSession): AuthUser {
  const {
    username,
    role,
    professionalId,
    canAccessAgenda,
    canAccessCommissions,
    agendaScope,
    mustChangePassword,
  } = session;
  return {
    username,
    role,
    professionalId,
    canAccessAgenda,
    canAccessCommissions,
    agendaScope,
    mustChangePassword,
  };
}

export function isStaffSpaRequestAllowed(
  session: AuthenticatedSession,
  method: string,
  path: string,
) {
  if (session.role === "admin") return true;

  const verb = method.toUpperCase();
  if (verb === "GET" && path === "/professionals") {
    return session.canAccessAgenda || session.canAccessCommissions;
  }
  if (verb === "GET" && path === "/services") return session.canAccessAgenda;
  if (verb === "GET" && path === "/appointments") return session.canAccessAgenda;
  if (verb === "POST" && path === "/appointments") return session.canAccessAgenda;
  if (
    (verb === "PATCH" || verb === "DELETE") &&
    /^\/appointments\/\d+$/.test(path)
  ) return session.canAccessAgenda;
  if (
    verb === "GET" &&
    /^\/commissions\/(summary|items(?:\/\d+)?|closures|audit)$/.test(path)
  ) return session.canAccessCommissions;
  return false;
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

export async function requireSession(req: Request, res: Response, next: NextFunction) {
  const session = await resolveSession(req.cookies?.[COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  res.locals.session = session;
  next();
}

export { COOKIE_NAME };