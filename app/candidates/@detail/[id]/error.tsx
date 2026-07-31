'use client';

import { useEffect } from 'react';

/**
 * Error boundary for the detail pane.
 *
 * Scoped to the slot so a failed candidate fetch leaves the list rail intact —
 * the reviewer can simply click the next person instead of losing the page.
 * Like the list boundary, `error.message` is not rendered.
 */
export default function DetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Candidate detail failed to load:', error);
  }, [error]);

  return (
    <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-5">
      <h2 className="text-base font-semibold text-rose-900">Could not load this candidate</h2>
      <p className="mt-1 text-sm text-rose-800">
        Something went wrong fetching their profile. The candidate list is unaffected — you can
        retry, or pick someone else.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-rose-700">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
