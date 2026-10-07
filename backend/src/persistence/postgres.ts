import { DefaultAzureCredential } from '@azure/identity';
import { Pool, type PoolConfig } from 'pg';
import type { Engagement, TrailBundle } from '../engine/types';
import type { EvalReport } from '../eval/harness';
import type { Data, Persistence } from '../store';

// PostgreSQL runs as a managed service on every hyperscaler (Azure Database
// for PostgreSQL, Amazon RDS / Aurora, Google Cloud SQL), which makes it the
// portable system of record for the platform's working state and audit trail.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS engagements (
  id          text PRIMARY KEY,
  doc         jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_trail (
  seq            integer PRIMARY KEY,
  id             text NOT NULL UNIQUE,
  engagement_id  text NOT NULL,
  module_id      text NOT NULL,
  actor          text NOT NULL,
  prev_hash      char(64) NOT NULL,
  hash           char(64) NOT NULL UNIQUE,
  bundle         jsonb NOT NULL,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_trail_engagement ON audit_trail (engagement_id, seq);
CREATE TABLE IF NOT EXISTS eval_runs (
  id   text PRIMARY KEY,
  at   timestamptz NOT NULL,
  doc  jsonb NOT NULL
);
-- The audit trail is append-only at the database level, whatever the application does.
CREATE OR REPLACE FUNCTION audit_trail_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_trail is append-only';
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_trail_no_update ON audit_trail;
CREATE TRIGGER audit_trail_no_update BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_trail
  FOR EACH STATEMENT EXECUTE FUNCTION audit_trail_append_only();
`;

export interface PostgresOptions {
  connectionString: string;
  /** "password" (in the URL) or "azure-ad" (managed identity token as password). */
  auth?: 'password' | 'azure-ad';
  ssl?: boolean;
}

export class PostgresPersistence implements Persistence {
  readonly kind = 'postgres';
  readonly pool: Pool;

  constructor(opts: PostgresOptions) {
    const config: PoolConfig = { connectionString: opts.connectionString, max: 10 };
    if (opts.ssl) config.ssl = { rejectUnauthorized: true };
    if (opts.auth === 'azure-ad') {
      // Entra ID authentication for Azure Database for PostgreSQL: the pool
      // asks for a fresh token whenever it opens a connection.
      const credential = new DefaultAzureCredential();
      config.password = async () => (await credential.getToken('https://ossrdbms-aad.database.windows.net/.default')).token;
    }
    this.pool = new Pool(config);
  }

  async load(): Promise<Data> {
    await this.pool.query(SCHEMA);
    const [eng, trail, evals] = await Promise.all([
      this.pool.query('SELECT doc FROM engagements ORDER BY doc->>\'createdAt\''),
      this.pool.query('SELECT bundle FROM audit_trail ORDER BY seq'),
      this.pool.query('SELECT doc FROM eval_runs ORDER BY at'),
    ]);
    return {
      engagements: eng.rows.map((r) => r.doc),
      trail: trail.rows.map((r) => r.bundle),
      evalRuns: evals.rows.map((r) => r.doc),
    };
  }

  async saveEngagement(e: Engagement) {
    await this.pool.query(
      `INSERT INTO engagements (id, doc, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
      [e.id, JSON.stringify(e)],
    );
  }

  async appendTrail(b: TrailBundle) {
    await this.pool.query(
      `INSERT INTO audit_trail (seq, id, engagement_id, module_id, actor, prev_hash, hash, bundle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [b.seq, b.id, b.engagementId, b.moduleId, b.actor, b.prevHash, b.hash, JSON.stringify(b)],
    );
  }

  async saveEvalRun(r: EvalReport) {
    await this.pool.query('INSERT INTO eval_runs (id, at, doc) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [r.id, r.at, JSON.stringify(r)]);
  }

  async healthy() {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}
