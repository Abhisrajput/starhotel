import type OpenAI from 'openai';
import { z } from 'zod';
import type { GenerateRequest, GenerateResult, LlmProvider } from './provider';
import { ProviderError } from './provider';

/**
 * Any OpenAI-protocol endpoint: Azure OpenAI, OpenAI, or a self-hosted
 * OpenAI-compatible server (vLLM, Ollama, LiteLLM) for open-weight models.
 * Output is constrained with a JSON schema and re-validated with zod.
 */
export class OpenAIProvider implements LlmProvider {
  constructor(
    readonly id: string,
    readonly model: string,
    private client: OpenAI,
    private strictSchema = true,
  ) {}

  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 16000,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'module_output', schema: strictJsonSchema(req.schema), strict: this.strictSchema } },
    });

    const choice = completion.choices[0];
    if (!choice) throw new ProviderError('Model returned no choices.');
    if (choice.message.refusal) throw new ProviderError('Model declined the request; no draft produced.');
    if (choice.finish_reason === 'length') throw new ProviderError('Model output was truncated; no draft produced.');
    if (choice.finish_reason === 'content_filter') throw new ProviderError('Content filter blocked the output; no draft produced.');

    let json: unknown;
    try {
      json = JSON.parse(choice.message.content ?? '');
    } catch {
      throw new ProviderError('Model output was not valid JSON.');
    }
    const parsed = req.schema.safeParse(json);
    if (!parsed.success) throw new ProviderError('Model output did not match the required schema.');
    return { output: parsed.data, servedModel: completion.model || this.model };
  }
}

/**
 * Strict structured outputs require every object to list all properties as
 * required and forbid additional properties.
 */
export function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    delete n.$schema;
    if (n.type === 'object' && n.properties && typeof n.properties === 'object') {
      n.required = Object.keys(n.properties);
      n.additionalProperties = false;
    }
    Object.values(n).forEach(visit);
  };
  visit(json);
  return json;
}
