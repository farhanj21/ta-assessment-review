import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount between tests so queries can never match a leftover tree from the
// previous test — the usual cause of a suite that passes alone and fails in
// sequence. Harmless in the node-environment tests, which never mount anything.
afterEach(() => {
  cleanup();
});
