import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { evalMarkdown, runEval } from './eval/harness';
import { authMiddleware, demoAuth, type Authenticator } from './auth';
import type { User } from './engine/types';
import { AppError, AuditService, USERS } from './service';
import { buildTraceability } from './validation/traceability';

const NewEngagementSchema = z.object({
  name: z.string().min(1),
  entity: z.string().min(1),
  site: z.string().min(1),
  periodFrom: z.string().min(1),
  periodTo: z.string().min(1),
  auditType: z.string().min(1),
  scopeStatement: z.string().min(1),
  packIds: z.array(z.string()).min(1),
});

const TestInputSchema = z.object({
  designAdequate: z.boolean().nullable(),
  observation: z.string(),
  evidenceRefs: z.array(z.string().min(1)),
  sampleTested: z.number().int().min(0),
  exceptions: z.number().int().min(0),
});

const FindingPatchSchema = z
  .object({
    title: z.string().min(1),
    rating: z.enum(['High', 'Medium', 'Low']),
    condition: z.string().min(1),
    criteria: z.string().min(1),
    cause: z.string().min(1),
    effect: z.string().min(1),
    recommendation: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)),
  })
  .partial();

export function createApp(svc: AuditService, auth: Authenticator = demoAuth()) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(authMiddleware(auth));

  const actor = (_req: Request): User => {
    const u = _req.res?.locals.user as User | null | undefined;
    if (!u) throw new AppError(401, 'Sign-in required');
    return u;
  };
  const param = (req: Request, name: string) => String(req.params[name]);
  const wrap = (fn: (req: Request, res: Response) => unknown) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res)).catch(next);

  app.get('/api/health', (_req, res) => res.json({ ok: true, provider: svc.providerInfo, models: svc.models.describe() }));
  // Liveness and readiness probes for any orchestrator (Container Apps, ECS, Cloud Run, Kubernetes).
  app.get('/api/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/api/readyz', wrap(async (_req, res) => {
    const storage = await svc.store.healthy();
    res.status(storage ? 200 : 503).json({ ok: storage, storage: svc.store.kind });
  }));
  app.get('/api/config', (_req, res) => res.json({ auth: auth.clientConfig }));
  // Demo mode lists the switchable demo users; with OIDC it returns the signed-in user only.
  app.get('/api/users', (_req, res) => res.json(auth.mode === 'demo' ? USERS : [res.locals.user].filter(Boolean)));
  app.get('/api/me', (_req, res) => res.json(res.locals.user ?? null));
  app.get('/api/modules', (_req, res) => res.json(svc.modules()));

  // ----- Content library -----
  app.get('/api/packs', (_req, res) =>
    res.json(svc.registry.list().map(({ clauses, controls, evalCases, ...p }) => ({ ...p, clauseCount: clauses.length, controlCount: controls.length, evalCaseCount: evalCases.length }))),
  );
  app.get('/api/packs/:id', wrap((req, res) => {
    const pack = svc.registry.packs.get(param(req, 'id'));
    if (!pack) throw new AppError(404, 'Pack not found');
    res.json(pack);
  }));
  app.get('/api/search', (req, res) => {
    const q = String(req.query.q ?? '');
    const packIds = req.query.packs ? String(req.query.packs).split(',') : svc.registry.list().map((p) => p.id);
    const allowed = new Set(svc.registry.clausesFor(packIds).map((c) => c.id));
    const hits = svc.grounding.clauses.search(q, 10, (id) => allowed.has(id));
    res.json(hits.map((h) => ({ ...h, clause: svc.registry.clauses.get(h.clauseId) })));
  });

  // ----- Engagements -----
  app.get('/api/engagements', (_req, res) =>
    res.json(svc.store.engagements.map((e) => ({ id: e.id, name: e.name, entity: e.entity, site: e.site, auditType: e.auditType, packIds: e.packIds, stage: e.stage, createdAt: e.createdAt, periodFrom: e.periodFrom, periodTo: e.periodTo,
      findings: e.findings.length, rcm: e.rcm.length,
      approved: e.findings.filter((f) => f.status === 'approved').length,
      awaitingSignOff: e.findings.filter((f) => f.status === 'draft' || f.status === 'reviewed').length,
      blocked: e.findings.filter((f) => f.status === 'blocked').length,
      tested: Object.values(e.testResults).filter((r) => r.conclusion !== 'Not tested').length }))),
  );
  app.post('/api/engagements', wrap(async (req, res) => {
    const body = NewEngagementSchema.parse(req.body);
    res.status(201).json(await svc.createEngagement(body, actor(req)));
  }));
  app.get('/api/engagements/:id', wrap((req, res) => res.json(svc.engagement(param(req, 'id')))));

  app.post('/api/engagements/:id/modules/:moduleId/run', wrap(async (req, res) => {
    const { bundle, engagement } = await svc.runModule(param(req, 'id'), param(req, 'moduleId'), actor(req), req.body ?? {});
    res.json({ bundle, engagement });
  }));

  app.put('/api/engagements/:id/scope', wrap(async (req, res) => {
    const items = z.array(z.object({ controlId: z.string(), included: z.boolean() })).parse(req.body.items);
    res.json(await svc.setScope(param(req, 'id'), items, actor(req)));
  }));

  app.put('/api/engagements/:id/tests/:rowId', wrap(async (req, res) => {
    res.json(await svc.recordTest(param(req, 'id'), param(req, 'rowId'), TestInputSchema.parse(req.body), actor(req)));
  }));

  app.put('/api/engagements/:id/findings/:fid', wrap(async (req, res) => {
    res.json(await svc.editFinding(param(req, 'id'), param(req, 'fid'), FindingPatchSchema.parse(req.body), actor(req)));
  }));

  app.post('/api/engagements/:id/findings/:fid/signoff', wrap(async (req, res) => {
    const body = z.object({ action: z.enum(['review', 'approve', 'reject']), comment: z.string().default('') }).parse(req.body);
    res.json(await svc.signOff(param(req, 'id'), param(req, 'fid'), body.action, body.comment, actor(req)));
  }));

  app.get('/api/engagements/:id/report.md', wrap((req, res) => {
    const e = svc.engagement(param(req, 'id'));
    if (!e.report) throw new AppError(404, 'No report generated yet');
    res.type('text/markdown').attachment(`${e.id}-report.md`).send(e.report.markdown);
  }));

  app.get('/api/engagements/:id/findings.csv', wrap((req, res) => {
    res.type('text/csv').attachment(`${param(req, 'id')}-findings.csv`).send(svc.findingsCsv(param(req, 'id')));
  }));

  // ----- Evidence & validation -----
  app.get('/api/engagements/:id/trail', wrap((req, res) => res.json(svc.trailFor(param(req, 'id')))));
  app.get('/api/trail/verify', (_req, res) => res.json(svc.verifyTrail()));

  app.post('/api/eval/run', wrap(async (_req, res) => {
    const report = await runEval(svc.registry, svc.models);
    await svc.store.addEvalRun(report);
    res.json(report);
  }));
  app.get('/api/eval/runs', (_req, res) => res.json(svc.store.evalRuns.map(({ cases, ...r }) => r).reverse()));
  app.get('/api/eval/runs/:id', wrap((req, res) => {
    const r = svc.store.evalRuns.find((x) => x.id === param(req, 'id'));
    if (!r) throw new AppError(404, 'Eval run not found');
    res.json({ ...r, markdown: evalMarkdown(r) });
  }));
  app.get('/api/validation/traceability', (_req, res) => res.json(buildTraceability(svc.store.evalRuns.at(-1) ?? null)));

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request', issues: err.issues });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}
