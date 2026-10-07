import type { Engagement, TrailBundle } from './engine/types';
import type { EvalReport } from './eval/harness';

// Working state is held in memory and written through to a Persistence
// adapter on every change. The platform writes findings back to the client's
// QMS/GRC system of record; it does not try to become one.

export interface Data {
  engagements: Engagement[];
  trail: TrailBundle[];
  evalRuns: EvalReport[];
}

/** Port implemented by each storage backend (see src/persistence). */
export interface Persistence {
  readonly kind: string;
  load(): Promise<Data>;
  saveEngagement(e: Engagement): Promise<void>;
  appendTrail(b: TrailBundle): Promise<void>;
  saveEvalRun(r: EvalReport): Promise<void>;
  healthy(): Promise<boolean>;
  close(): Promise<void>;
}

export class Store {
  private data: Data;

  /** Without a persistence adapter the store is in-memory only (tests, eval). */
  constructor(private persistence: Persistence | null = null, data?: Data) {
    this.data = data ?? { engagements: [], trail: [], evalRuns: [] };
  }

  static async open(persistence: Persistence): Promise<Store> {
    return new Store(persistence, await persistence.load());
  }

  get kind() {
    return this.persistence?.kind ?? 'memory';
  }
  get engagements() {
    return this.data.engagements;
  }
  get trail() {
    return this.data.trail;
  }
  get evalRuns() {
    return this.data.evalRuns;
  }

  findEngagement(id: string) {
    return this.data.engagements.find((e) => e.id === id);
  }

  async saveEngagement(e: Engagement) {
    if (!this.data.engagements.includes(e)) this.data.engagements.push(e);
    await this.persistence?.saveEngagement(e);
  }

  async appendTrail(b: TrailBundle) {
    this.data.trail.push(b);
    await this.persistence?.appendTrail(b);
  }

  async addEvalRun(r: EvalReport) {
    this.data.evalRuns.push(r);
    await this.persistence?.saveEvalRun(r);
  }

  healthy() {
    return this.persistence ? this.persistence.healthy() : Promise.resolve(true);
  }

  close() {
    return this.persistence ? this.persistence.close() : Promise.resolve();
  }
}
