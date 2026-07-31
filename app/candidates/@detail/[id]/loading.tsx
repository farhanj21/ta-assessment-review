/**
 * Loading UI for the detail pane only.
 *
 * This is the payoff of the parallel-route split: selecting a candidate streams
 * this skeleton into the right-hand pane while the list rail stays rendered and
 * clickable, so a reviewer can keep moving down the list without waiting.
 */
export default function DetailLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading candidate…</span>

      <div className="animate-pulse rounded-2xl border border-surface-200 bg-white p-5">
        <div className="h-6 w-1/3 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-1/2 rounded bg-slate-100" />
        <div className="mt-4 flex gap-2">
          <div className="h-6 w-24 rounded-full bg-slate-100" />
          <div className="h-6 w-28 rounded-full bg-slate-100" />
        </div>
      </div>

      {[0, 1].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="animate-pulse rounded-2xl border border-surface-200 bg-white p-5"
        >
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-3 space-y-2">
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-11/12 rounded bg-slate-100" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
