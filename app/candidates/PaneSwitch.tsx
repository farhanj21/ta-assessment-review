'use client';

import { usePathname } from 'next/navigation';

/**
 * The only Client Component in the layout shell, and deliberately tiny.
 *
 * Both parallel-route slots always render — `@detail/default.tsx` fills the
 * detail slot even at `/candidates`. On desktop that is exactly what we want
 * (list beside an "select a candidate" placeholder). On mobile there is only
 * room for one, so something has to decide which.
 *
 * That decision depends on the current URL, which is client state, hence
 * `usePathname`. It is CSS-only — both panes stay mounted and in the DOM, so
 * navigating back to the list does not re-fetch it and the browser keeps the
 * list's scroll position.
 *
 * Note this is presentation only: it never gates data or permissions. Anything
 * a user must not see is removed on the server in lib/candidates.ts, not
 * hidden with a class here.
 */
export function PaneSwitch({
  pane,
  children,
}: {
  pane: 'list' | 'detail';
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // `/candidates` → list only. `/candidates/<id>` → detail only.
  const hasSelection = pathname !== '/candidates' && pathname.startsWith('/candidates/');

  const hiddenOnMobile = pane === 'list' ? hasSelection : !hasSelection;

  return (
    // `lg:block` unconditionally restores both panes at the desktop breakpoint,
    // so the mobile rule can never leak into the two-column layout.
    <div className={hiddenOnMobile ? 'hidden lg:block' : 'block'}>{children}</div>
  );
}
