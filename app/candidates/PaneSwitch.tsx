'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * On small viewports the layout can only show one pane at a time.
 * This client wrapper reads the current route segment and decides
 * which slot to render. On >=lg it is not used — both slots are
 * visible side by side via CSS.
 */
export function PaneSwitch({
  pane,
  children,
}: {
  pane: 'list' | 'detail';
  children: ReactNode;
}) {
  const pathname = usePathname();
  const hasSelection = pathname !== '/candidates' && pathname.startsWith('/candidates/');
  const hiddenOnMobile = pane === 'list' ? hasSelection : !hasSelection;

  return (
    <div className={hiddenOnMobile ? 'hidden lg:block' : 'block'}>{children}</div>
  );
}
