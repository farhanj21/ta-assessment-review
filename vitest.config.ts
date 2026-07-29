import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Mirrors the `@/*` path alias in tsconfig.json so tests import modules
      // by the same specifier the app does.
      '@': path.resolve(__dirname, './'),
      // See tests/stubs/server-only.ts — without this, importing any server
      // module under Vitest throws by design.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
  test: {
    globals: true,
    // 'node' by default because most of what is worth testing here (filter
    // parsing, the Server Action) is server code. Component tests opt into
    // jsdom with a `@vitest-environment jsdom` docblock, so we don't pay for a
    // DOM in tests that don't need one.
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    env: {
      // A dedicated database file, so running tests never touches the dev data
      // a reviewer has been clicking through. Prisma resolves relative SQLite
      // paths against the schema directory, so this is prisma/test.db.
      DATABASE_URL: 'file:./test.db',
      DEMO_USER_ROLE: 'REVIEWER',
    },
    // The Server Action test writes to a shared SQLite file; SQLite takes a
    // single writer, so test files run one at a time rather than racing.
    fileParallelism: false,
  },
});
