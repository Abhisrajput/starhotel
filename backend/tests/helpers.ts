import type { GenerateRequest, GenerateResult, LlmProvider } from '../src/engine/llm/provider';
import { ModelRouter } from '../src/engine/llm/router';
import { PackRegistry } from '../src/engine/packs';
import { AuditService, USERS } from '../src/service';
import { Store } from '../src/store';

export const registry = PackRegistry.loadFromDir();
export const [auditor, reviewer, approver] = USERS;

export function newService(llm: LlmProvider | null = null) {
  return new AuditService(new Store(null), registry, ModelRouter.fixed(llm));
}

/** A scripted model: returns whatever the handler builds for the request. */
export class FakeProvider implements LlmProvider {
  readonly id = 'fake';
  readonly model = 'fake-1';
  constructor(private handler: (req: GenerateRequest<any>) => unknown) {}
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    return { output: req.schema.parse(this.handler(req)), servedModel: this.model };
  }
}

export async function engagementWithFailedControl(svc: AuditService, controlId = 'FD-HACCP-03', evidenceRefs = ['CCP-LOG-MAR']) {
  const e = await svc.createEngagement(
    {
      name: 'Test audit', entity: 'Demo Foods', site: 'Plant 1', periodFrom: '2026-01-01', periodTo: '2026-06-30',
      auditType: 'Food safety', scopeStatement: 'HACCP CCP monitoring, supplier approval, traceability and allergen controls', packIds: ['food', 'common'],
    },
    auditor,
  );
  await svc.runModule(e.id, 'scope', auditor);
  await svc.setScope(e.id, [{ controlId, included: true }], auditor);
  await svc.runModule(e.id, 'rcm', auditor);
  await svc.recordTest(e.id, controlId, { designAdequate: true, observation: '3 of 20 CCP logs unsigned.', evidenceRefs, sampleTested: 20, exceptions: 3 }, auditor);
  await svc.runModule(e.id, 'testing', auditor);
  await svc.runModule(e.id, 'gaps', auditor);
  return svc.engagement(e.id);
}
