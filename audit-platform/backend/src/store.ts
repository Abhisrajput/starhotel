import fs from 'node:fs';
import path from 'node:path';
import type { Engagement, TrailBundle } from './engine/types';
import type { EvalReport } from './eval/harness';

// Minimal JSON-file persistence for the MVP. The platform is meant to write
// findings back to the client's QMS/GRC system of record, not to become one,
// so this only holds working state and the audit trail. Swap for Postgres /
// Dataverse behind the same methods for production.

interface Data {
  engagements: Engagement[];
  trail: TrailBundle[];
  evalRuns: EvalReport[];
}

export class Store {
  private data: Data = { engagements: [], trail: [], evalRuns: [] };

  /** Pass null for an in-memory store (tests). */
  constructor(private file: string | null) {
    if (file && fs.existsSync(file)) {
      this.data = { ...this.data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
    }
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

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
