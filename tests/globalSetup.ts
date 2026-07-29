import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Creates the test database once per `npm test` run.
 *
 * `db push` rather than `migrate deploy`: the test database is disposable and
 * we only care that its shape matches the current schema. Deleting the file
 * first guarantees a clean slate, so a failing test can never be caused by rows
 * left behind by a previous run.
 */
export default function globalSetup() {
  const testDbPath = path.resolve(__dirname, '../prisma/test.db');
  rmSync(testDbPath, { force: true });
  rmSync(`${testDbPath}-journal`, { force: true });

  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}
