import pg from "pg";

export const createTestPool = () =>
  new pg.Pool({ connectionString: process.env.SPA_TEST_DATABASE_URL });

export const createPostgresRepository = (pool) => ({
  async load() {
    const result = await pool.query(
      "SELECT version, payload FROM spa_operational_state WHERE id = 1",
    );
    return result.rows[0] ?? null;
  },

  async insertIfAbsent(version, payload) {
    const result = await pool.query(
      `INSERT INTO spa_operational_state (id, version, payload)
       VALUES (1, $1, $2::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [version, JSON.stringify(payload)],
    );
    return result.rowCount > 0;
  },

  async save(version, payload) {
    const result = await pool.query(
      `UPDATE spa_operational_state
       SET version = $1, payload = $2::jsonb, updated_at = now()
       WHERE id = 1
       RETURNING id`,
      [version, JSON.stringify(payload)],
    );
    if (result.rowCount === 0) throw new Error("missing SPA state row");
  },
});