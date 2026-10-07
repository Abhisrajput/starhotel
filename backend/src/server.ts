import path from 'node:path';
import { createApp } from './app';
import { ModelRouter } from './engine/llm/router';
import { PackRegistry } from './engine/packs';
import { AuditService } from './service';
import { Store } from './store';

const port = Number(process.env.PORT ?? 3002);
const dataFile = process.env.DATA_FILE ?? path.resolve(__dirname, '../data/db.json');

const registry = PackRegistry.loadFromDir(process.env.PACKS_DIR);
const svc = new AuditService(new Store(dataFile), registry, new ModelRouter());

createApp(svc).listen(port, () => {
  console.log(`Audit platform API on :${port} — packs: ${registry.list().map((p) => `${p.id}@${p.version}`).join(', ')} — provider: ${svc.providerInfo.id}/${svc.providerInfo.model}`);
});
