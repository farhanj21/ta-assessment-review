import { ListPane } from './ListPane';

/**
 * The list at /candidates (nothing selected).
 *
 * In Next 15 `searchParams` is a Promise — awaiting it is what marks this page
 * as dynamic. That is correct here: the response depends entirely on the query
 * string, so there is nothing to statically prerender. See the README's caching
 * section for why the list is allowed to be briefly stale but is not cached
 * across users.
 */
export default async function ListSlotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ListPane searchParams={await searchParams} />;
}
