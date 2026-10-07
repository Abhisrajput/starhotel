import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import { AnthropicFoundry } from '@anthropic-ai/foundry-sdk';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import OpenAI, { AzureOpenAI } from 'openai';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import type { GenerateRequest, GenerateResult, LlmProvider } from './provider';
import { ProviderError } from './provider';

export const OFFLINE = { id: 'offline', model: 'deterministic-rules-v1' } as const;

type Env = Record<string, string | undefined>;

/**
 * Model profiles. Each reads only its own environment variables, so a profile
 * is selected by configuration and never needs a code change. Credentials come
 * from the environment (Key Vault / Secrets Manager / Secret Manager inject
 * them) or from the workload identity of the host.
 */
export const PROFILES: Record<string, { description: string; build: (env: Env) => LlmProvider }> = {
  anthropic: {
    description: 'Claude via the Anthropic API (ANTHROPIC_API_KEY)',
    build: (env) => new ClaudeProvider('anthropic', env.ANTHROPIC_MODEL || 'claude-opus-5-5', new Anthropic(), true),
  },
  'anthropic-foundry': {
    description: 'Claude via Microsoft Foundry (ANTHROPIC_FOUNDRY_RESOURCE; API key or managed identity)',
    build: (env) => {
      const resource = required(env, 'ANTHROPIC_FOUNDRY_RESOURCE');
      const client = env.ANTHROPIC_FOUNDRY_API_KEY
        ? new AnthropicFoundry({ resource, apiKey: env.ANTHROPIC_FOUNDRY_API_KEY })
        : new AnthropicFoundry({ resource, azureADTokenProvider: getBearerTokenProvider(new DefaultAzureCredential(), 'https://ai.azure.com/.default') });
      return new ClaudeProvider('anthropic-foundry', env.ANTHROPIC_FOUNDRY_MODEL || 'claude-opus-5-5', client);
    },
  },
  'anthropic-bedrock': {
    description: 'Claude via Amazon Bedrock (AWS_REGION; IAM role or AWS credentials)',
    build: (env) => new ClaudeProvider('anthropic-bedrock', env.BEDROCK_MODEL || 'anthropic.claude-opus-5-5', new AnthropicBedrockMantle({ awsRegion: required(env, 'AWS_REGION') }) as never),
  },
  'anthropic-vertex': {
    description: 'Claude via Google Vertex AI (VERTEX_PROJECT_ID; workload identity / ADC)',
    build: (env) =>
      new ClaudeProvider('anthropic-vertex', env.VERTEX_MODEL || 'claude-opus-5-5', new AnthropicVertex({ projectId: required(env, 'VERTEX_PROJECT_ID'), region: env.VERTEX_REGION || 'global' }) as never),
  },
  'azure-openai': {
    description: 'Azure OpenAI (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT; API key or managed identity)',
    build: (env) => {
      const deployment = required(env, 'AZURE_OPENAI_DEPLOYMENT');
      const common = { endpoint: required(env, 'AZURE_OPENAI_ENDPOINT'), deployment, apiVersion: env.AZURE_OPENAI_API_VERSION || '2024-10-21' };
      const client = env.AZURE_OPENAI_API_KEY
        ? new AzureOpenAI({ ...common, apiKey: env.AZURE_OPENAI_API_KEY })
        : new AzureOpenAI({ ...common, azureADTokenProvider: getBearerTokenProvider(new DefaultAzureCredential(), 'https://cognitiveservices.azure.com/.default') });
      return new OpenAIProvider('azure-openai', deployment, client);
    },
  },
  'openai-compatible': {
    description: 'OpenAI or a self-hosted OpenAI-compatible server such as vLLM or Ollama (OPENAI_BASE_URL, OPENAI_MODEL)',
    build: (env) =>
      new OpenAIProvider(
        'openai-compatible',
        required(env, 'OPENAI_MODEL'),
        new OpenAI({ baseURL: env.OPENAI_BASE_URL || undefined, apiKey: env.OPENAI_API_KEY || 'not-needed' }),
        env.OPENAI_STRICT_SCHEMA !== 'false',
      ),
  },
};

function required(env: Env, name: string): string {
  const v = env[name];
  if (!v) throw new Error(`${name} must be set for this model profile`);
  return v;
}

/** Tries each provider in turn; the first success wins. */
export class ChainProvider implements LlmProvider {
  readonly id: string;
  readonly model: string;
  constructor(private chain: LlmProvider[]) {
    this.id = chain.map((p) => p.id).join('>');
    this.model = chain[0].model;
  }
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    const errors: string[] = [];
    for (const p of this.chain) {
      try {
        return await p.generate(req);
      } catch (err) {
        errors.push(`${p.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new ProviderError(`All providers failed — ${errors.join(' | ')}`);
  }
}

/**
 * Chooses the model for each module. Configuration:
 *   LLM_DEFAULT=azure-openai>anthropic-foundry   (">" builds a fallback chain)
 *   LLM_ROUTES=gaps:anthropic-foundry,report:azure-openai
 * "offline" (the default) means the module's deterministic rules, no model.
 */
export class ModelRouter {
  private cache = new Map<string, LlmProvider | null>();
  readonly defaultSpec: string;
  readonly routes: Record<string, string>;

  constructor(private env: Env = process.env, private profiles: Record<string, { build: (env: Env) => LlmProvider }> = PROFILES) {
    this.defaultSpec = env.LLM_DEFAULT || env.LLM_PROVIDER || 'offline';
    this.routes = Object.fromEntries(
      (env.LLM_ROUTES ?? '')
        .split(',')
        .map((r) => r.split(':').map((s) => s.trim()))
        .filter(([m, spec]) => m && spec),
    );
    // Fail fast on misconfiguration at startup rather than mid-audit.
    for (const spec of [this.defaultSpec, ...Object.values(this.routes)]) this.resolve(spec);
  }

  /** A router where every module uses the same provider (tests, eval). */
  static fixed(provider: LlmProvider | null): ModelRouter {
    const r = new ModelRouter({ LLM_DEFAULT: 'offline' });
    r.cache.set('offline', provider);
    return r;
  }

  private resolve(spec: string): LlmProvider | null {
    if (this.cache.has(spec)) return this.cache.get(spec)!;
    const parts = spec.split('>').map((s) => s.trim()).filter((s) => s && s !== 'offline');
    for (const p of parts) if (!this.profiles[p]) throw new Error(`Unknown model profile "${p}" (known: offline, ${Object.keys(this.profiles).join(', ')})`);
    const providers = parts.map((p) => this.profiles[p].build(this.env));
    const provider = providers.length === 0 ? null : providers.length === 1 ? providers[0] : new ChainProvider(providers);
    this.cache.set(spec, provider);
    return provider;
  }

  forModule(moduleId: string): LlmProvider | null {
    return this.resolve(this.routes[moduleId] ?? this.defaultSpec);
  }

  describe() {
    const info = (p: LlmProvider | null) => (p ? { id: p.id, model: p.model } : { ...OFFLINE });
    return {
      default: info(this.resolve(this.defaultSpec)),
      routes: Object.fromEntries(Object.entries(this.routes).map(([m, spec]) => [m, info(this.resolve(spec))])),
    };
  }
}
