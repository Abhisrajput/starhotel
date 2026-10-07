import type { AuditModule } from '../module';
import { gapsModule } from './gaps';
import { rcmModule } from './rcm';
import { reportModule } from './report';
import { scopeModule } from './scope';
import { testingModule } from './testing';

/** The common audit chain, in execution order. Vertical packs add content, not code. */
export const MODULES: AuditModule<any>[] = [scopeModule, rcmModule, testingModule, gapsModule, reportModule];

export function getModule(id: string): AuditModule<any> {
  const m = MODULES.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown module ${id}`);
  return m;
}
