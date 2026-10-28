import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './database';

export default function migrateTestDatabase(): void {
  execFileSync('pnpm', ['--filter', '@cf/db', 'migrate'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'ignore',
  });
}
