import Link from 'next/link';

/**
 * Triggered by `notFound()` in the detail page when the id does not resolve —
 * a stale bookmark, a shared link to a since-deleted candidate, or a typo.
 *
 * Deliberately distinct from error.tsx: "this does not exist" is a different
 * message from "something broke", and offering "try again" for a 404 would just
 * waste the user's time.
 */
export default function CandidateNotFound() {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-6 text-center">
      <h2 className="text-base font-semibold text-slate-900">Candidate not found</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
        This candidate may have been removed, or the link is out of date.
      </p>
      <Link
        href="/candidates"
        className="mt-4 inline-block rounded-md border border-slate-300 bg-white px-3 py-2
                   text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
      >
        Back to all candidates
      </Link>
    </div>
  );
}
