import type { z } from 'zod';
import type { ModuleContext } from '../module';
import { sha256 } from '../trail';

export const SYSTEM_PREAMBLE = `You are a drafting assistant inside an internal-audit platform for regulated manufacturers.
You draft; a qualified human auditor reviews and signs off. Rules:
- Use only the facts, controls and clauses given in the request. Do not invent evidence, numbers, names or dates.
- Cite regulations only by the clause IDs supplied. Never cite a clause that is not in the list.
- Write in plain, factual audit language. No speculation about intent.`;

/**
 * Asks the configured model for a structured draft. Returns null when no model
 * is configured or the call fails, in which case the module uses its
 * deterministic path. Either way the prompt hash and outcome go into the trail.
 */
export async function askModel<T>(ctx: ModuleContext, system: string, user: string, schema: z.ZodType<T>): Promise<T | null> {
  if (!ctx.llm) return null;
  ctx.promptHash = sha256(system + '\n---\n' + user);
  ctx.step('model', `Requesting draft from ${ctx.llm.id}/${ctx.llm.model}`);
  try {
    const res = await ctx.llm.generate({ system, user, schema });
    ctx.servedModel = res.servedModel;
    ctx.step('model', `Draft received from ${res.servedModel}`);
    return res.output;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    ctx.step('model', `Model call failed: ${msg}. Falling back to deterministic rules.`);
    ctx.gate({ gate: 'model-availability', outcome: 'warn', target: 'module', detail: msg, action: 'flagged' });
    return null;
  }
}
