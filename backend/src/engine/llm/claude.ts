import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { GenerateRequest, GenerateResult, LlmProvider } from './provider';
import { ProviderError } from './provider';

/**
 * Claude on any platform. The first-party client and the Microsoft Foundry,
 * Amazon Bedrock and Google Vertex clients share the same `beta.messages.parse`
 * surface, so one adapter serves all four; only client construction differs.
 */
type ClaudeClient = { beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> } };

export class ClaudeProvider implements LlmProvider {
  private resolved: ClaudeClient | null = null;

  constructor(
    readonly id: string,
    readonly model: string,
    /** A client, or a factory called on first use so no credential lookup happens at startup. */
    private client: ClaudeClient | (() => ClaudeClient),
    /** Server-side refusal fallback is only available on the first-party API. */
    private serverFallback = false,
  ) {}

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    this.resolved ??= typeof this.client === 'function' ? this.client() : this.client;
    const response = await this.resolved.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      ...(this.serverFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: betaZodOutputFormat(req.schema) },
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    });

    if (response.stop_reason === 'refusal') {
      throw new ProviderError('Model declined the request; no draft produced.');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ProviderError('Model output was truncated (max_tokens); no draft produced.');
    }
    if (response.parsed_output == null) {
      throw new ProviderError('Model output did not match the required schema.');
    }
    return { output: response.parsed_output as T, servedModel: response.model };
  }
}
