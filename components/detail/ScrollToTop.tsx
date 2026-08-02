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
    const scrollToTop = () => {
      // Walk up the DOM to find the overflow container (the
      // lg:overflow-y-auto wrapper in layout.tsx), then reset its
      // scroll position.
      let el = markerRef.current?.parentElement ?? null;
      while (el) {
        const { overflowY } = getComputedStyle(el);
        if (overflowY === 'auto' || overflowY === 'scroll') {
          el.scrollTo({ top: 0, left: 0 });
          return;
        }
        el = el.parentElement;
      }
      // Fallback: scroll the window itself (mobile / no overflow container).
      window.scrollTo({ top: 0, left: 0 });
    };

    // Scroll immediately for the common case.
    scrollToTop();

    // Also scroll after a rAF — the browser (or Next.js router) may restore
    // scroll position asynchronously after React commits, which would undo an
    // earlier reset. A double-rAF puts us after layout, paint, *and* any
    // post-paint scroll-restoration the browser queues up.
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(scrollToTop);
    });
    let innerFrame: number | undefined;

    return () => {
      cancelAnimationFrame(outerFrame);
      if (innerFrame !== undefined) cancelAnimationFrame(innerFrame);
    };
  }, [pathname]);

  return <div ref={markerRef} aria-hidden="true" style={{ display: 'none' }} />;
}
