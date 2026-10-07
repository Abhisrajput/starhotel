import path from 'node:path';
import type { Persistence } from '../store';
import { JsonFilePersistence } from './json-file';
import { PostgresPersistence } from './postgres';

/**
 * STORAGE=json (default, local dev) | postgres (any cloud's managed Postgres).
 * DATABASE_URL, DATABASE_AUTH=password|azure-ad, DATABASE_SSL=true|false.
 */
export function createPersistence(env: Record<string, string | undefined> = process.env): Persistence | null {
  const kind = env.STORAGE ?? 'json';
  switch (kind) {
    case 'memory':
      return null;
    case 'json':
      return new JsonFilePersistence(env.DATA_FILE ?? path.resolve(__dirname, '../../data/db.json'));
    case 'postgres': {
      if (!env.DATABASE_URL) throw new Error('DATABASE_URL must be set when STORAGE=postgres');
      return new PostgresPersistence({
        connectionString: env.DATABASE_URL,
        auth: env.DATABASE_AUTH === 'azure-ad' ? 'azure-ad' : 'password',
        ssl: env.DATABASE_SSL !== 'false',
      });
    }
    default:
      throw new Error(`Unknown STORAGE "${kind}" (expected json | postgres | memory)`);
  }
}
