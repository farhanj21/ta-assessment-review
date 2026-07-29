/**
 * Loading UI for the list pane only.
 *
 * Next wraps the slot in a Suspense boundary using this file, so a slow list
 * query streams a skeleton here while the rest of the page — header, shell,
 * detail pane — renders and stays interactive.
 *
 * The skeleton mirrors the real row layout (title line, meta line, badge row)
 * so the content does not jump when it swaps in. That is a layout-stability
 * choice, not a cosmetic one.
 */
export default function ListLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="mt-4">
      <span className="sr-only">Loading candidates…</span>

      <div className="h-[420px] animate-pulse rounded-lg border border-slate-200 bg-white" />

      <ul className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <li
            key={index}
            aria-hidden="true"
            className="animate-pulse rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="w-full space-y-2">
                <div className="h-4 w-2/5 rounded bg-slate-200" />
                <div className="h-3 w-3/5 rounded bg-slate-100" />
              </div>
              <div className="h-6 w-10 shrink-0 rounded bg-slate-200" />
            </div>
            <div className="mt-3 flex gap-2">
              <div className="h-5 w-20 rounded-full bg-slate-100" />
              <div className="h-5 w-24 rounded-full bg-slate-100" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
