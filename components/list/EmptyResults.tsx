import Link from 'next/link';

/**
 * Empty state.
 *
 * Two things make this useful rather than decorative: it says *why* the list is
 * empty (filters, not missing data), and it offers the one-click escape. A bare
 * "No results" leaves the user unsure whether the app is broken.
 */
export function EmptyResults() {
  return (
    <div className="mt-2 rounded-2xl border border-dashed border-surface-300 bg-white p-6 text-center">
      <p className="text-sm font-medium text-slate-900">No candidates match these filters</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">
        Try widening the score range or clearing a filter — a narrow range excludes anyone whose
        assessment has not been scored yet.
      </p>
      <Link
        href="/candidates"
        className="mt-4 inline-block rounded-lg border border-surface-200 bg-white px-3 py-2
                   text-sm font-medium text-brand-700 shadow-card hover:bg-brand-50 transition-colors"
      >
        Clear all filters
      </Link>
    </div>
  );
}
