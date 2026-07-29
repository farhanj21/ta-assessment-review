import { PaneSwitch } from './PaneSwitch';

/**
 * Two-pane shell, built on parallel routes.
 *
 * Why parallel routes and not `layout.tsx` renders the list + `[id]/page.tsx`
 * renders the detail:
 *
 *  1. Layouts do not receive `searchParams`. All filter state lives in the URL
 *     query string, so the list *must* be a page to read it. A slot's page.tsx
 *     does receive searchParams; a layout never will, by design, because
 *     layouts are not re-rendered on a search-param-only navigation.
 *
 *  2. Independent Suspense and error boundaries per pane. `@detail/[id]/
 *     loading.tsx` streams a skeleton into the right pane while the list stays
 *     fully interactive, and `@detail/[id]/error.tsx` contains a failed detail
 *     fetch without destroying the filters you just set.
 *
 * The cost: `@list/[id]/page.tsx` re-renders the list when you select someone.
 * `listCandidates` is wrapped in React `cache()`, so that is one DB query per
 * request rather than two.
 *
 * `params`/`searchParams` are intentionally not touched here — see (1).
 */
export default function CandidatesLayout({
  list,
  detail,
}: {
  list: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
      {/*
        Desktop: a fixed-width list rail beside a fluid detail pane, both
        independently scrollable so long reviewer comments never push the
        filters off screen.
        Mobile: a single column; PaneSwitch decides which pane is mounted.
      */}
      <div className="lg:grid lg:grid-cols-[minmax(340px,420px)_1fr] lg:gap-6">
        <PaneSwitch pane="list">
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
            {list}
          </div>
        </PaneSwitch>

        <PaneSwitch pane="detail">
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
            {detail}
          </div>
        </PaneSwitch>
      </div>
    </div>
  );
}
