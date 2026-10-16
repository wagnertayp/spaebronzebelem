import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { attachPostgresPoolErrorHandlers } from "./postgres-pool-errors";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 20_000,
  query_timeout: 25_000,
  idleTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  maxLifetimeSeconds: 1_800,
});
attachPostgresPoolErrorHandlers(pool, (scope, error) => {
  const pgError = error as Error & { code?: string };
  console.error(`[db] PostgreSQL ${scope} connection error`, {
    message: pgError.message,
    code: pgError.code,
  });
});
export const db = drizzle(pool, { schema });

export * from "./schema";
export { tryAcquirePostgresAdvisoryLock } from "./postgres-advisory-lock";
