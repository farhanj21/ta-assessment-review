'use client';

import { useEffect } from 'react';

/**
 * Error boundary for the list pane.
 *
 * `error.tsx` must be a Client Component — React error boundaries rely on
 * lifecycle behaviour that only exists on the client, and `reset` is a callback.
 *
 * Scoped to the slot on purpose: a failed list query shows this in the rail
 * while the detail pane and the app header keep working, instead of replacing
 * the whole screen.
 *
 * `error.message` is deliberately not rendered. In production Next replaces it
 * with a generic string and a digest anyway, but relying on that would mean a
 * dev-only leak of database internals into the UI. The digest is shown instead
 * so a user can quote it in a bug report.
 */
export default function ListError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Where a real error tracker (Sentry, etc.) would be called.
    console.error('Candidate list failed to load:', error);
  }, [error]);

  return (
    <div role="alert" className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-4">
      <h2 className="text-sm font-semibold text-rose-900">Could not load candidates</h2>
      <p className="mt-1 text-sm text-rose-800">
        The list failed to load. Your filters are still in the URL, so retrying will keep them.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-rose-700">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-white hover:bg-rose-800"
      >
        Try again
      </button>
    </div>
  );
}
