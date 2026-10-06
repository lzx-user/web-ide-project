import fs from 'node:fs/promises';
import path from 'node:path';

import { closePool, getPool } from './pool.js';

const migrationDir = path.join(__dirname, 'migrations');

async function migrate() {
  const files = (await fs.readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationDir, file), 'utf8');
    await getPool().query(sql);
    console.log(`Applied ${file}`);
  }
}

migrate().finally(closePool).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
