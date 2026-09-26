import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run database migrations.");
}

const pool = new Pool({
  connectionString,
  max: 1,
});

try {
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
  });
} finally {
  await pool.end();
}