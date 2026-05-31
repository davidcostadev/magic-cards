import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, createApp } from './app.factory';

/**
 * Boots Nest without `listen`, emits the committed `openapi.json`, then exits.
 * Uses an in-memory DB so generation has no side effects (architecture §2).
 */
async function generate(): Promise<void> {
  process.env.DATABASE_PATH = ':memory:';
  const app = await createApp();
  const document = buildOpenApiDocument(app);
  const outPath = resolve(process.cwd(), 'openapi.json');
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  process.stdout.write(`Wrote ${outPath}\n`);
}

void generate().then(() => process.exit(0));
