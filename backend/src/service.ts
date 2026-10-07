import crypto from 'node:crypto';
import { Bm25Index, clauseText, controlText } from './engine/grounding';
import type { ModelRouter } from './engine/llm/router';
import { ModuleContext, type Grounding } from './engine/module';
import { getModule, MODULES } from './engine/modules';
import type { PackRegistry } from './engine/packs';
import { findingCitationGate } from './engine/qa';
import { seal, verifyChain } from './engine/trail';
import type { Engagement, Finding, QaAction, SignOff, TestInput, TrailBundle, User } from './engine/types';
import type { Store } from './store';

export const ENGINE_VERSION = '0.1.0';

export const USERS: User[] = [
  { id: 'auditor', name: 'Asha Auditor', role: 'auditor' },
  { id: 'reviewer', name: 'Ravi Reviewer', role: 'reviewer' },
  { id: 'approver', name: 'Priya QA Head', role: 'approver' },
];

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface NewEngagement {
  name: string;
  entity: string;
  site: string;
  periodFrom: string;
  periodTo: string;
  auditType: string;
  scopeStatement: string;
  packIds: string[];
}

const PREPARERS = ['auditor', 'reviewer'];

export class AuditService {
  readonly grounding: Grounding;

  constructor(readonly store: Store, readonly registry: PackRegistry, readonly models: ModelRouter) {
    this.grounding = {
      clauses: new Bm25Index([...registry.clauses.values()].map((c) => ({ id: c.id, text: clauseText(c) }))),
      controls: new Bm25Index([...registry.controls.values()].map((c) => ({ id: c.id, text: controlText(c) }))),
    };
  }

  /** Default model plus any per-module routes. */
  get providerInfo() {
    return this.models.describe().default;
  }

  private require(user: User, roles: string[], what: string) {
    if (!roles.includes(user.role)) throw new AppError(403, `${user.role} may not ${what}`);
  }

  engagement(id: string): Engagement {
    const e = this.store.findEngagement(id);
    if (!e) throw new AppError(404, `Engagement ${id} not found`);
    return e;
  }

  async createEngagement(input: NewEngagement, actor: User): Promise<Engagement> {
    this.require(actor, PREPARERS, 'create engagements');
    if (!input.packIds.length) throw new AppError(400, 'Select at least one content pack');
    input.packIds.forEach((id) => {
      if (!this.registry.packs.has(id)) throw new AppError(400, `Unknown pack ${id}`);
    });
    const e: Engagement = {
      id: `ENG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      ...input,
      createdBy: actor.id,
      createdAt: new Date().toISOString(),
      stage: 'planning',
      scope: [],
      rcm: [],
      testInputs: {},
      testResults: {},
      findings: [],
      report: null,
    };
    await this.store.saveEngagement(e);
    await this.recordHuman(e, 'human:create-engagement', actor, input, { id: e.id });
    return e;
  }

  // ---------- Module orchestration ----------

  async runModule(engagementId: string, moduleId: string, actor: User, input: Record<string, unknown> = {}) {
    this.require(actor, PREPARERS, 'run modules');
    const e = this.engagement(engagementId);
    const mod = (() => {
      try {
        return getModule(moduleId);
      } catch {
        throw new AppError(404, `Unknown module ${moduleId}`);
      }
    })();
    const blocker = mod.precondition(e);
    if (blocker) throw new AppError(409, blocker);

    const startedAt = new Date().toISOString();
    const llm = this.models.forModule(mod.id);
    const ctx = new ModuleContext(e, this.registry, this.grounding, llm, actor, input);
    ctx.step('start', `${mod.name} v${mod.version} on ${e.id}`);
    const output = await mod.run(ctx);
    ctx.step('end', `${ctx.qa.filter((q) => q.outcome === 'fail').length} gate failure(s), ${ctx.qa.filter((q) => q.outcome === 'warn').length} warning(s)`);

    const bundle = await this.append({
      id: `RUN-${crypto.randomBytes(4).toString('hex')}`,
      engagementId: e.id,
      moduleId: mod.id,
      moduleVersion: mod.version,
      engineVersion: ENGINE_VERSION,
      packVersions: this.registry.versions(e.packIds),
      provider: llm ? { id: llm.id, model: ctx.servedModel ?? llm.model } : { id: 'offline', model: 'deterministic-rules-v1' },
      promptHash: ctx.promptHash,
      actor: actor.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      inputs: { moduleInput: input, stage: e.stage },
      retrievalSet: ctx.retrievalSet,
      executionLog: ctx.log,
      qaActions: ctx.qa,
      output,
    });
    mod.apply(e, output, bundle.id);
    await this.store.saveEngagement(e);
    return { bundle, engagement: e };
  }

  // ---------- Human steps (also written to the trail) ----------

  async setScope(engagementId: string, items: { controlId: string; included: boolean }[], actor: User) {
    this.require(actor, PREPARERS, 'change scope');
    const e = this.engagement(engagementId);
    for (const it of items) {
      const s = e.scope.find((x) => x.controlId === it.controlId);
      if (!s) throw new AppError(400, `Control ${it.controlId} is not a scope candidate`);
      s.included = it.included;
    }
    await this.store.saveEngagement(e);
    await this.recordHuman(e, 'human:scope-decision', actor, items, { included: e.scope.filter((s) => s.included).map((s) => s.controlId) });
    return e;
  }

  async recordTest(engagementId: string, rowId: string, input: Omit<TestInput, 'updatedBy' | 'updatedAt'>, actor: User) {
    this.require(actor, PREPARERS, 'record test work');
    const e = this.engagement(engagementId);
    if (!e.rcm.some((r) => r.id === rowId)) throw new AppError(404, `RCM row ${rowId} not found`);
    if (input.exceptions > input.sampleTested) throw new AppError(400, 'Exceptions cannot exceed the sample tested');
    const record: TestInput = { ...input, updatedBy: actor.id, updatedAt: new Date().toISOString() };
    e.testInputs[rowId] = record;
    delete e.testResults[rowId];
    await this.store.saveEngagement(e);
    await this.recordHuman(e, 'human:test-record', actor, { rowId, ...input }, record);
    return e;
  }

  async editFinding(engagementId: string, findingId: string, patch: Partial<Pick<Finding, 'title' | 'rating' | 'condition' | 'criteria' | 'cause' | 'effect' | 'recommendation' | 'evidenceRefs'>>, actor: User) {
    this.require(actor, PREPARERS, 'edit findings');
    const e = this.engagement(engagementId);
    const idx = e.findings.findIndex((f) => f.id === findingId);
    if (idx < 0) throw new AppError(404, `Finding ${findingId} not found`);
    if (e.findings[idx].status === 'approved') throw new AppError(409, 'Approved findings are locked');

    const allowed = new Set(this.registry.clausesFor(e.packIds).map((c) => c.id));
    const edited: Finding = { ...e.findings[idx], ...patch, status: 'draft', signOffs: [] };
    const { finding, actions } = findingCitationGate(this.registry, edited, allowed);
    e.findings[idx] = finding;
    await this.store.saveEngagement(e);
    await this.recordHuman(e, 'human:finding-edit', actor, { findingId, patch }, { status: finding.status }, actions);
    return finding;
  }

  async signOff(engagementId: string, findingId: string, action: 'review' | 'approve' | 'reject', comment: string, actor: User) {
    const e = this.engagement(engagementId);
    const f = e.findings.find((x) => x.id === findingId);
    if (!f) throw new AppError(404, `Finding ${findingId} not found`);
    if (f.status === 'blocked') throw new AppError(409, `Finding is blocked by QA gates: ${f.blockedReasons.join('; ')}`);

    let meaning: SignOff['meaning'];
    if (action === 'review') {
      this.require(actor, ['reviewer'], 'review findings');
      if (f.status !== 'draft') throw new AppError(409, `Only draft findings can be reviewed (status ${f.status})`);
      f.status = 'reviewed';
      meaning = 'Reviewed';
    } else {
      this.require(actor, ['approver'], `${action} findings`);
      if (f.status !== 'reviewed') throw new AppError(409, 'Finding must be reviewed before approval or rejection');
      if (f.signOffs.some((s) => s.userId === actor.id)) throw new AppError(409, 'Approver must differ from reviewer');
      f.status = action === 'approve' ? 'approved' : 'rejected';
      meaning = action === 'approve' ? 'Approved' : 'Rejected';
    }
    // Signature manifestation: who, in what role, what it means, and when.
    const sig: SignOff = { userId: actor.id, userName: actor.name, role: actor.role, meaning, comment, at: new Date().toISOString() };
    f.signOffs.push(sig);
    await this.store.saveEngagement(e);
    await this.recordHuman(e, 'human:sign-off', actor, { findingId, action, comment }, sig);
    return f;
  }

  // ---------- Trail ----------

  private async append(bundle: Omit<TrailBundle, 'hash' | 'prevHash' | 'seq'>): Promise<TrailBundle> {
    // seal() and the in-memory push happen synchronously, so concurrent
    // requests cannot fork the chain; persistence then catches up in order.
    const sealed = seal(this.store.trail, bundle);
    await this.store.appendTrail(sealed);
    return sealed;
  }

  private async recordHuman(e: Engagement, moduleId: string, actor: User, inputs: unknown, output: unknown, qaActions: QaAction[] = []) {
    const now = new Date().toISOString();
    await this.append({
      id: `HUM-${crypto.randomBytes(4).toString('hex')}`,
      engagementId: e.id,
      moduleId,
      moduleVersion: ENGINE_VERSION,
      engineVersion: ENGINE_VERSION,
      packVersions: this.registry.versions(e.packIds),
      provider: { id: 'human', model: actor.id },
      promptHash: null,
      actor: actor.id,
      startedAt: now,
      finishedAt: now,
      inputs,
      retrievalSet: [],
      executionLog: [{ at: now, step: moduleId, detail: `${actor.name} (${actor.role})` }],
      qaActions,
      output,
    });
  }

  trailFor(engagementId: string) {
    return this.store.trail.filter((b) => b.engagementId === engagementId);
  }

  verifyTrail() {
    return verifyChain(this.store.trail);
  }

  modules() {
    return MODULES.map((m) => ({ id: m.id, name: m.name, version: m.version, description: m.description }));
  }

  /** Flat export for write-back into the client's QMS / GRC system of record. */
  findingsCsv(engagementId: string): string {
    const e = this.engagement(engagementId);
    const cols = ['id', 'status', 'rating', 'controlId', 'title', 'condition', 'criteria', 'cause', 'effect', 'recommendation', 'citations', 'evidenceRefs', 'approvedBy', 'bundleId'];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = e.findings.map((f) =>
      [
        f.id, f.status, f.rating, f.controlId, f.title, f.condition, f.criteria, f.cause, f.effect, f.recommendation,
        f.citations.map((c) => `${c.regulation} ${c.ref}`).join('; '),
        f.evidenceRefs.join('; '),
        f.signOffs.filter((s) => s.meaning === 'Approved').map((s) => `${s.userName} ${s.at}`).join('; '),
        f.bundleId,
      ].map((v) => esc(String(v))).join(','),
    );
    return [cols.join(','), ...rows].join('\n');
  }
}
