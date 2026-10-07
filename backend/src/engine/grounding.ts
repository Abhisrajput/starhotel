import type { Clause, Control, RetrievalHit } from './types';

// Grounding index: a small BM25 keyword index over clauses and controls with
// clause-level metadata. Deliberately dependency-free and deterministic so that
// retrieval sets are reproducible in the audit trail. Swap for a vector index
// (e.g. Azure AI Search) behind the same interface when the corpus grows.

const STOPWORDS = new Set(
  'a an and are as at be by for from has have in is it its of on or that the this to was were will with not no all any each per must should shall'.split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.§ ]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[.§]+|[.§]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

// Light suffix stripping so "records"/"recorded"/"recording" meet.
function stem(t: string): string {
  if (/^\d/.test(t)) return t;
  return t.replace(/(ing|ed|es|s)$/, '').replace(/(ation)$/, 'at') || t;
}

interface Doc {
  id: string;
  tokens: string[];
  tf: Map<string, number>;
}

export class Bm25Index {
  private docs: Doc[] = [];
  private df = new Map<string, number>();
  private avgLen = 0;

  constructor(entries: { id: string; text: string }[], private k1 = 1.4, private b = 0.75) {
    for (const e of entries) {
      const tokens = tokenize(e.text);
      const tf = new Map<string, number>();
      tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
      tf.forEach((_, t) => this.df.set(t, (this.df.get(t) ?? 0) + 1));
      this.docs.push({ id: e.id, tokens, tf });
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.tokens.length, 0) / Math.max(1, this.docs.length);
  }

  search(query: string, k = 8, filter?: (id: string) => boolean): RetrievalHit[] {
    const q = [...new Set(tokenize(query))];
    const N = this.docs.length;
    const hits: RetrievalHit[] = [];
    for (const d of this.docs) {
      if (filter && !filter(d.id)) continue;
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        const n = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.tokens.length) / this.avgLen));
      }
      if (score > 0) hits.push({ clauseId: d.id, score: Math.round(score * 1000) / 1000 });
    }
    return hits.sort((a, b) => b.score - a.score || a.clauseId.localeCompare(b.clauseId)).slice(0, k);
  }
}

export function clauseText(c: Clause): string {
  return [c.regulation, c.ref, c.title, c.summary, c.tags.join(' ')].join(' ');
}

export function controlText(c: Control): string {
  return [c.title, c.processArea, c.objective, c.risk, c.keywords.join(' '), c.checklist.join(' ')].join(' ');
}
