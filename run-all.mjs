// Run: node tests/run-all.mjs   (Node 18+, no dependencies)
import { readdirSync } from 'node:fs';
for (const f of readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.test.mjs')).sort())
  await import('./' + f);
