import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ModelRouter } from '../src/engine/llm/router';
import { verifyChain } from '../src/engine/trail';
import { PostgresPersistence } from '../src/persistence/postgres';
import { AuditService } from '../src/service';
import { Store } from '../src/store';
import { engagementWithFailedControl, registry, reviewer } from './helpers';

// Runs against a real PostgreSQL server (embedded binaries), the same engine
// used by Azure Database for PostgreSQL, Amazon RDS and Google Cloud SQL.
describe('PostgreSQL persistence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  const port = 54000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({ databaseDir: dir, port, user: 'audit', password: 'audit', persistent: false, createPostgresUser: true });
  const url = `postgres://audit:audit@127.0.0.1:${port}/postgres`;
  const persistence = () => new PostgresPersistence({ connectionString: url, ssl: false });

  beforeAll(async () => {
    await pg.initialise();
    await pg.start();
  }, 120_000);
  afterAll(async () => {
    await pg.stop();
  });

  it('survives a restart with state and audit trail intact [REQ-16, REQ-07]', async () => {
    const p1 = persistence();
    const svc1 = new AuditService(await Store.open(p1), registry, ModelRouter.fixed(null));
    const e = await engagementWithFailedControl(svc1);
    await svc1.signOff(e.id, e.findings[0].id, 'review', 'ok', reviewer);
    const trailLength = svc1.store.trail.length;
    await p1.close();

    const p2 = persistence();
    const store2 = await Store.open(p2);
    const reloaded = store2.findEngagement(e.id)!;
    expect(reloaded.findings[0].status).toBe('reviewed');
    expect(reloaded.rcm.length).toBe(e.rcm.length);
    expect(store2.trail).toHaveLength(trailLength);
    expect(verifyChain(store2.trail).valid).toBe(true);

    // New work continues the same chain after restart.
    const svc2 = new AuditService(store2, registry, ModelRouter.fixed(null));
    await svc2.runModule(e.id, 'report', { id: 'auditor', name: 'Asha Auditor', role: 'auditor' });
    expect(verifyChain(store2.trail).valid).toBe(true);
    await p2.close();
  }, 60_000);

  it('refuses to update or delete audit-trail rows at the database level [REQ-07]', async () => {
    const p = persistence();
    await p.load();
    await expect(p.pool.query("UPDATE audit_trail SET actor = 'mallory'")).rejects.toThrow(/append-only/);
    await expect(p.pool.query('DELETE FROM audit_trail')).rejects.toThrow(/append-only/);
    await expect(p.pool.query('TRUNCATE audit_trail')).rejects.toThrow(/append-only/);
    expect(await p.healthy()).toBe(true);
    await p.close();
  });
});
