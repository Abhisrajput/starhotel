import { AnthropicProvider } from './anthropic';
import type { LlmProvider } from './provider';

export const OFFLINE = { id: 'offline', model: 'deterministic-rules-v1' } as const;

/**
 * Picks the provider for a run. "offline" (the default) uses each module's
 * deterministic rules and needs no network or key. "anthropic" needs
 * ANTHROPIC_API_KEY (or another credential the SDK can resolve).
 */
export function createProvider(name = process.env.LLM_PROVIDER ?? 'offline'): LlmProvider | null {
  switch (name) {
    case 'offline':
      return null;
    case 'anthropic':
      return new AnthropicProvider(process.env.ANTHROPIC_MODEL || undefined);
    default:
      throw new Error(`Unknown LLM_PROVIDER "${name}" (expected offline | anthropic)`);
  }
}
