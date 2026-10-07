import fs from 'node:fs';
import { seedDemo } from './demo';
import { ModelRouter } from './engine/llm/router';
import { PackRegistry } from './engine/packs';
import { createPersistence } from './persistence';
import { AuditService } from './service';
import { Store } from './store';

// Seeds the demo engagements into the configured storage (STORAGE=json|postgres).
// Usage: npm run seed            (refuses to seed a store that already has data)
//        npm run seed -- --reset (json storage only: start from an empty file)
async function main() {
  if (process.argv.includes('--reset') && (process.env.STORAGE ?? 'json') === 'json') {
    const file = process.env.DATA_FILE ?? `${__dirname}/../data/db.json`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  const persistence = createPersistence();
  const store = persistence ? await Store.open(persistence) : new Store();
  if (store.engagements.length) {
    console.error(`Store (${store.kind}) already has ${store.engagements.length} engagements; not seeding. Use --reset for json storage.`);
    process.exitCode = 1;
    return store.close();
  }
  const svc = new AuditService(store, PackRegistry.loadFromDir(), new ModelRouter());
  const [food, pharma] = await seedDemo(svc);
  console.log(`Seeded ${food.id} (${food.findings.length} findings) and ${pharma.id} (${pharma.findings.length} findings) into ${store.kind} storage`);
  console.log('Trail:', svc.verifyTrail());
  await store.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
