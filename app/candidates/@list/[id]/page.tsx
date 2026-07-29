import { ListPane } from '../ListPane';

/**
 * The same list at /candidates/<id>, with the open candidate highlighted.
 *
 * Without this file the `@list` slot would fall back to default.tsx on a
 * candidate URL and the list would disappear on selection. `listCandidates` is
 * wrapped in React `cache()`, so re-rendering the list here costs no extra
 * database query within the request.
 */
export default async function ListSlotWithSelection({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  return <ListPane searchParams={resolvedSearchParams} selectedId={id} />;
}
