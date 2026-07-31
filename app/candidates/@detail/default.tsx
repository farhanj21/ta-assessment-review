/**
 * `default.tsx` fills the `@detail` slot whenever the current URL has no
 * matching page inside it — i.e. at /candidates, and on a hard reload where
 * Next cannot recover the slot's previous state.
 *
 * Without this file the slot would render nothing and the desktop grid would
 * collapse to a lone list rail. On mobile it is never visible: PaneSwitch
 * unmounts the detail column until a candidate is selected.
 */
export default function NoCandidateSelected() {
  return (
    <div className="hidden h-full min-h-[60vh] place-items-center rounded-2xl border border-dashed border-surface-300 bg-white p-8 lg:grid">
      <div className="max-w-xs text-center">
        <p className="text-sm font-medium text-slate-900">No candidate selected</p>
        <p className="mt-1 text-sm text-slate-600">
          Choose someone from the list to see their profile, assessment brief and review history.
        </p>
      </div>
    </div>
  );
}
