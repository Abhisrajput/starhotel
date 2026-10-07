import express from 'express';
import type { AddressInfo } from 'node:net';
import OpenAI from 'openai';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ClaudeProvider } from '../src/engine/llm/claude';
import { OpenAIProvider, strictJsonSchema } from '../src/engine/llm/openai';
import type { GenerateRequest, LlmProvider } from '../src/engine/llm/provider';
import { ChainProvider, ModelRouter, PROFILES } from '../src/engine/llm/router';
import { auditor, engagementWithFailedControl } from './helpers';
import { AuditService } from '../src/service';
import { Store } from '../src/store';
import { registry } from './helpers';

const Schema = z.object({ items: z.array(z.object({ controlId: z.string(), included: z.boolean() })), note: z.string() });
const req: GenerateRequest<z.infer<typeof Schema>> = { system: 's', user: 'u', schema: Schema };

describe('OpenAI-protocol adapter (Azure OpenAI, OpenAI, vLLM, Ollama)', () => {
  let server: ReturnType<express.Express['listen']>;
  let baseURL = '';
  const seen: any[] = [];
  let reply: any = {};

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.post('/v1/chat/completions', (r, res) => {
      seen.push(r.body);
      res.json({ id: 'x', object: 'chat.completion', created: 0, model: 'served-model', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: null, refusal: null, ...reply } }] });
    });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });
  afterAll(() => server.close());

  const provider = () => new OpenAIProvider('openai-compatible', 'my-model', new OpenAI({ baseURL, apiKey: 'k' }));

  it('requests strict JSON-schema output and validates the reply [REQ-14]', async () => {
    reply = { content: JSON.stringify({ items: [{ controlId: 'A', included: true }], note: 'ok' }) };
    const out = await provider().generate(req);
    expect(out).toEqual({ output: { items: [{ controlId: 'A', included: true }], note: 'ok' }, servedModel: 'served-model' });
    const body = seen.at(-1);
    expect(body.model).toBe('my-model');
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 's' });
  });

  it('rejects output that does not match the schema [REQ-14]', async () => {
    reply = { content: JSON.stringify({ items: 'nope' }) };
    await expect(provider().generate(req)).rejects.toThrow(/schema/);
    reply = { content: 'not json' };
    await expect(provider().generate(req)).rejects.toThrow(/JSON/);
  });

  it('surfaces refusals as provider errors [REQ-14]', async () => {
    reply = { content: null, refusal: 'cannot help' };
    await expect(provider().generate(req)).rejects.toThrow(/declined/);
  });

  it('makes schemas strict-compatible at every level', () => {
    const s = strictJsonSchema(z.object({ a: z.string(), b: z.object({ c: z.number() }).optional() })) as any;
    expect(s.required).toEqual(['a', 'b']);
    expect(s.additionalProperties).toBe(false);
    expect(s.$schema).toBeUndefined();
  });
});

describe('Claude adapter (Anthropic API, Foundry, Bedrock, Vertex)', () => {
  const fake = (response: any, calls: any[]) => ({ beta: { messages: { parse: async (p: any) => (calls.push(p), response) } } }) as any;

  it('uses structured output, and server-side fallback only where supported', async () => {
    const calls: any[] = [];
    const ok = { stop_reason: 'end_turn', parsed_output: { items: [], note: 'n' }, model: 'claude-opus-5-5' };
    await new ClaudeProvider('anthropic', 'claude-opus-5-5', fake(ok, calls), true).generate(req);
    await new ClaudeProvider('anthropic-foundry', 'claude-opus-5-5', fake(ok, calls), false).generate(req);
    expect(calls[0].fallbacks).toBe('default');
    expect(calls[0].betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(calls[1].fallbacks).toBeUndefined();
    expect(calls[1].output_config.format).toBeDefined();
    expect(calls[1].thinking).toEqual({ type: 'adaptive' });
  });

  it('treats refusal and truncation as provider errors', async () => {
    await expect(new ClaudeProvider('x', 'm', fake({ stop_reason: 'refusal' }, [])).generate(req)).rejects.toThrow(/declined/);
    await expect(new ClaudeProvider('x', 'm', fake({ stop_reason: 'max_tokens' }, [])).generate(req)).rejects.toThrow(/truncated/);
  });
});

describe('model router', () => {
  const stub = (id: string, fail = false): LlmProvider => ({
    id,
    model: `${id}-model`,
    generate: async (r) => {
      if (fail) throw new Error(`${id} down`);
      return { output: r.schema.parse({ items: [], note: id }), servedModel: `${id}-model` };
    },
  });
  const profiles = { a: { build: () => stub('a') }, b: { build: () => stub('b') }, down: { build: () => stub('down', true) } };

  it('routes modules to different providers by configuration', () => {
    const r = new ModelRouter({ LLM_DEFAULT: 'a', LLM_ROUTES: 'gaps:b, report:offline' }, profiles);
    expect(r.forModule('scope')?.id).toBe('a');
    expect(r.forModule('gaps')?.id).toBe('b');
    expect(r.forModule('report')).toBeNull();
    expect(r.describe()).toEqual({ default: { id: 'a', model: 'a-model' }, routes: { gaps: { id: 'b', model: 'b-model' }, report: { id: 'offline', model: 'deterministic-rules-v1' } } });
  });

  it('falls through a provider chain', async () => {
    const r = new ModelRouter({ LLM_DEFAULT: 'down>b' }, profiles);
    const p = r.forModule('scope')!;
    expect(p).toBeInstanceOf(ChainProvider);
    expect((await p.generate(req)).servedModel).toBe('b-model');
    await expect(new ModelRouter({ LLM_DEFAULT: 'down>down' }, profiles).forModule('x')!.generate(req)).rejects.toThrow(/All providers failed/);
  });

  it('fails fast on unknown profiles and missing settings', () => {
    expect(() => new ModelRouter({ LLM_DEFAULT: 'nope' }, profiles)).toThrow(/Unknown model profile/);
    expect(() => new ModelRouter({ LLM_DEFAULT: 'azure-openai' })).toThrow(/AZURE_OPENAI_DEPLOYMENT/);
    expect(() => new ModelRouter({ LLM_DEFAULT: 'anthropic-foundry' })).toThrow(/ANTHROPIC_FOUNDRY_RESOURCE/);
  });

  it('builds every cloud profile from configuration alone', () => {
    const env = {
      ANTHROPIC_API_KEY: 'k', ANTHROPIC_FOUNDRY_RESOURCE: 'res', AWS_REGION: 'us-east-1', VERTEX_PROJECT_ID: 'p',
      AZURE_OPENAI_ENDPOINT: 'https://x.openai.azure.com', AZURE_OPENAI_DEPLOYMENT: 'gpt', OPENAI_MODEL: 'llama3',
    };
    for (const name of Object.keys(PROFILES)) expect(PROFILES[name].build(env).id).toBe(name);
  });

  it('records the routed provider per module in the audit trail [REQ-06]', async () => {
    const llm = stub('a');
    const router = new ModelRouter({ LLM_DEFAULT: 'offline', LLM_ROUTES: 'scope:a' }, { a: { build: () => llm } });
    const svc = new AuditService(new Store(null), registry, router);
    const e = await engagementWithFailedControl(svc);
    const trail = svc.trailFor(e.id);
    expect(trail.find((b) => b.moduleId === 'scope')!.provider.id).toBe('a');
    expect(trail.find((b) => b.moduleId === 'rcm')!.provider.id).toBe('offline');
    void auditor;
  });
});
