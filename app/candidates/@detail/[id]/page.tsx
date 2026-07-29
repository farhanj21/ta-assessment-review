import { notFound } from 'next/navigation';
import { getCandidateDetail } from '@/lib/candidates';
import { canReview, getSession } from '@/lib/auth';
import { buildQueryString } from '@/lib/filters';
import { CandidateDetailPanel } from '@/components/detail/CandidateDetailPanel';

/**
 * Candidate detail — a Server Component in the `@detail` slot.
 *
 * The session is resolved here and the permission decision (`canReview`) is
 * made here, then passed down as a plain boolean. The Session object itself is
 * partly passed on (name, role, userId are all needed for display), but nothing
 * privileged travels with it — the role check that matters happens again inside
 * the Server Action.
 */
export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, resolvedSearchParams, session] = await Promise.all([
    params,
    searchParams,
    getSession(),
  ]);

  const candidate = await getCandidateDetail(id, session);

  // A stale bookmark or a deleted candidate is a 404, not a crash — this hands
  // off to not-found.tsx in this same slot rather than to error.tsx.
  if (!candidate) notFound();

  // Keep the active filters on the mobile "back" link so returning to the list
  // does not silently reset what the user had narrowed to.
  const queryString = buildQueryString(resolvedSearchParams, {});

  return (
    <CandidateDetailPanel
      candidate={candidate}
      session={session}
      canSubmitReview={canReview(session)}
      backHref={queryString ? `/candidates?${queryString}` : '/candidates'}
    />
  );
}
