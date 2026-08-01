import Link from 'next/link';
import { ROLE_LABELS } from '@/lib/enums';
import type { CandidateListItem, CandidateListResult } from '@/lib/candidates';
import { AssessmentStatusBadge, ScoreBadge, StageBadge } from '@/components/ui/badges';
import { EmptyResults } from './EmptyResults';

/**
 * The results list — a Server Component. It renders data and links, and has no
 * interactivity beyond navigation, so none of this code needs to reach the
 * browser. Each row is a plain <Link>, which is also what makes keyboard
 * support free and correct: real anchors are tabbable, activate on Enter,
 * support Ctrl/Cmd-click and "open in new tab", and are announced as links.
 *
 * A roving-tabindex listbox would cut the tab stops but would break all of
 * that, so the tab-stop cost is paid off with the skip link in the root layout
 * instead.
 */
export function CandidateList({
  result,
  selectedId,
  queryString,
}: {
  result: CandidateListResult;
  selectedId?: string;
  queryString: string;
}) {
  const { items, total, truncated } = result;

  return (
    <section aria-labelledby="results-heading" className="mt-4">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 id="results-heading" className="text-sm font-semibold text-slate-900">
          Candidates
        </h2>
        {/*
          aria-live announces the new count after a filter change. Without it a
          screen-reader user changes a dropdown and gets no feedback that the
          list underneath them changed. `polite` so it waits for a pause rather
          than interrupting.
        */}
        <p role="status" aria-live="polite" className="text-xs text-slate-600">
          {total === 0
            ? 'No candidates match'
            : `${total} candidate${total === 1 ? '' : 's'}${
                truncated ? ` (showing first ${items.length})` : ''
              }`}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyResults />
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((candidate) => (
            <li key={candidate.id}>
              <CandidateRow
                candidate={candidate}
                isSelected={candidate.id === selectedId}
                queryString={queryString}
              />
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="mt-3 rounded-lg bg-surface-100 px-3 py-2 text-xs text-slate-600">
          Showing the first {items.length} of {total}. Narrow the filters to see more — see the
          README on cursor pagination for larger volumes.
        </p>
      )}
    </section>
  );
}

function CandidateRow({
  candidate,
  isSelected,
  queryString,
}: {
  candidate: CandidateListItem;
  isSelected: boolean;
  queryString: string;
}) {
  return (
    <Link
      // The active filters ride along on every row link, so opening a candidate
      // and pressing back returns to the exact filtered list rather than an
      // unfiltered one.
      href={`/candidates/${candidate.id}${queryString ? `?${queryString}` : ''}`}
      // Disable Next.js's default scroll-to-top so the list pane stays put
      // and the detail pane scrolls itself to the top via ScrollToTop.
      scroll={false}
      // aria-current is the standard way to mark "this is the one you are on"
      // in a set of links — it is what makes the selection legible to a screen
      // reader, where the blue ring means nothing.
      aria-current={isSelected ? 'true' : undefined}
      className={`block rounded-xl border p-3 shadow-card transition-all ${
        isSelected
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30'
          : 'border-surface-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 hover:shadow-card-hover'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{candidate.fullName}</p>
          <p className="mt-0.5 truncate text-sm text-slate-600">
            {ROLE_LABELS[candidate.role]} · {candidate.city}
          </p>
        </div>
        <ScoreBadge score={candidate.score} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StageBadge stage={candidate.stage} />
        <AssessmentStatusBadge status={candidate.assessmentStatus} />
        {candidate.reviewCount > 0 ? (
          <span className="text-xs text-slate-600">
            {candidate.reviewCount} review{candidate.reviewCount === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-xs text-slate-500">Not reviewed</span>
        )}
      </div>
    </Link>
  );
}
