import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { createAuth } from './auth';
import { seedDemo } from './demo';
import { ModelRouter } from './engine/llm/router';
import { PackRegistry } from './engine/packs';
import { createPersistence } from './persistence';
import { AuditService } from './service';
import { Store } from './store';

// One container serves the API and, when STATIC_DIR is set, the built UI.
// All configuration comes from environment variables so the same image runs
// unchanged on Azure Container Apps, AWS App Runner / ECS, Google Cloud Run
// or Kubernetes.

async function main() {
  const port = Number(process.env.PORT ?? 3002);
  const registry = PackRegistry.loadFromDir(process.env.PACKS_DIR);
  const models = new ModelRouter();
  const persistence = createPersistence();
  const store = persistence ? await Store.open(persistence) : new Store();
  const svc = new AuditService(store, registry, models);

  if (process.env.SEED_DEMO === 'true' && store.engagements.length === 0) {
    await seedDemo(svc);
    log('info', 'Seeded demo engagements into empty store');
  }

  const auth = createAuth();
  const app = createApp(svc, auth);
  const staticDir = process.env.STATIC_DIR;
  if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  const server = app.listen(port, () =>
    log('info', 'Audit platform started', {
      port,
      storage: store.kind,
      auth: auth.mode,
      packs: registry.list().map((p) => `${p.id}@${p.version}`),
      models: models.describe(),
      ui: staticDir ?? null,
    }),
  );

  const shutdown = (signal: string) => {
    log('info', `Received ${signal}, shutting down`);
    server.close(() => store.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/** Structured JSON logs on stdout: picked up by Azure Monitor, CloudWatch and Cloud Logging alike. */
function log(level: string, msg: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }));
}

main().catch((err) => {
  log('error', 'Startup failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
