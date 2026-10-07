import fs from 'node:fs';
import path from 'node:path';
import type { Engagement, TrailBundle } from '../engine/types';
import type { EvalReport } from '../eval/harness';
import type { Data, Persistence } from '../store';

/** Single JSON file. For local development and demos only. */
export class JsonFilePersistence implements Persistence {
  readonly kind = 'json-file';
  private data: Data = { engagements: [], trail: [], evalRuns: [] };

  constructor(private file: string) {}

  async load(): Promise<Data> {
    if (fs.existsSync(this.file)) this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
    return structuredClone(this.data);
  }

  async saveEngagement(e: Engagement) {
    const i = this.data.engagements.findIndex((x) => x.id === e.id);
    if (i >= 0) this.data.engagements[i] = structuredClone(e);
    else this.data.engagements.push(structuredClone(e));
    this.flush();
  }

  async appendTrail(b: TrailBundle) {
    this.data.trail.push(structuredClone(b));
    this.flush();
  }

  async saveEvalRun(r: EvalReport) {
    this.data.evalRuns.push(structuredClone(r));
    this.flush();
  }

  async healthy() {
    return true;
  }

  async close() {}

  private flush() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
