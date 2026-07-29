import { listCandidates, listCities } from '@/lib/candidates';
import { buildQueryString, parseFilters } from '@/lib/filters';
import { FilterBar } from '@/components/filters/FilterBar';
import { CandidateList } from '@/components/list/CandidateList';

/**
 * Shared implementation of the `@list` slot.
 *
 * Both `@list/page.tsx` (/candidates) and `@list/[id]/page.tsx`
 * (/candidates/<id>) render this. The list must stay mounted and identical at
 * both URLs — a parallel-route slot needs a matching page for every path the
 * other slot can be at, or it falls back to default.tsx and the list would
 * vanish the moment you selected someone.
 *
 * This is a Server Component: it queries the database directly, with no API
 * layer, no client fetch and no loading waterfall. The only thing shipped to
 * the browser from this subtree is FilterBar.
 */
export async function ListPane({
  searchParams,
  selectedId,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  selectedId?: string;
}) {
  const filters = parseFilters(searchParams);

  // Both queries are independent, so they overlap rather than serialise.
  const [result, cities] = await Promise.all([listCandidates(filters), listCities()]);

  // Preserved on every row link so selection does not drop the active filters.
  const queryString = buildQueryString(searchParams, {});

  return (
    <div>
      <FilterBar filters={filters} cities={cities} />
      {/* Target of the skip link in the root layout. */}
      <div id="results" tabIndex={-1}>
        <CandidateList result={result} selectedId={selectedId} queryString={queryString} />
      </div>
    </div>
  );
}
