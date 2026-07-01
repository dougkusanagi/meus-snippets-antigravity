import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const env = { ...process.env };

if (args[0] === 'build') {
  const keyPath = resolve(process.cwd(), 'keys', 'updater.key');
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, 'utf8').trimEnd();
}

const result = spawnSync('bunx', ['tauri', ...args], {
  stdio: 'inherit',
  env,
});

process.exit(result.status ?? 1);
