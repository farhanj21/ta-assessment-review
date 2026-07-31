import type { ReactNode } from 'react';
import { PaneSwitch } from './PaneSwitch';

/**
 * Candidates layout — the shell around the parallel-route slots.
 *
 * On >= md the list is a fixed sidebar and the detail pane fills the rest.
 * On mobile, PaneSwitch toggles between them.
 *
 * No `<Suspense>` boundary is shown here on purpose — the page-level
 * `loading.tsx` files inside each slot would handle that if we added
 * skeleton UIs later.
 */
export default function CandidatesLayout({
  list,
  detail,
}: {
  list: ReactNode;
  detail: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="lg:grid lg:grid-cols-[minmax(340px,420px)_1fr] lg:gap-6">
        <PaneSwitch pane="list">
          <div className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1">
            {list}
          </div>
        </PaneSwitch>
        <PaneSwitch pane="detail">
          <div className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
            {detail}
          </div>
        </PaneSwitch>
      </div>
    </div>
  );
}
