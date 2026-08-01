'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Scrolls the nearest scrollable ancestor to the top whenever the
 * pathname changes. Drop this at the top of the detail pane so that
 * opening a new candidate does not leave the user scrolled to the
 * bottom of the previous one.
 *
 * This is a tiny Client Component — it ships almost no JS and renders
 * nothing visible.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const markerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Walk up the DOM to find the overflow container (the lg:overflow-y-auto
    // wrapper in layout.tsx), then reset its scroll position.
    let el = markerRef.current?.parentElement;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        el.scrollTop = 0;
        return;
      }
      el = el.parentElement;
    }
    // Fallback: scroll the window itself.
    window.scrollTo(0, 0);
  }, [pathname]);

  return <div ref={markerRef} aria-hidden="true" style={{ display: 'none' }} />;
}
