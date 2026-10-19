import { RefObject, useLayoutEffect, useState } from 'react';

/** The room kept on each side of a table spread into the margins. */
const GUTTER = 24;

/**
 * "Expand to margins" (T5): the table spreads beyond the page's text column
 * into the margins, over the whole width of the page area (minus a small
 * gutter), and follows it when the window or the side panel changes size.
 * Where the page area is no wider than the column, nothing changes.
 */
export const useExpandToMargins = (
  wrapperRef: RefObject<HTMLDivElement | null>,
  expanded: boolean,
) => {
  const [style, setStyle] = useState<{
    marginLeft: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    // The block holding the table keeps the column's width, and the page
    // area is what holds the centred column
    const host = wrapper?.parentElement;
    const area = wrapper?.closest('.--docs--doc-editor')?.parentElement;
    if (!expanded || !wrapper || !host || !area) {
      setStyle(null);
      return;
    }
    const place = () => {
      const areaBox = area.getBoundingClientRect();
      const hostBox = host.getBoundingClientRect();
      const width = areaBox.width - 2 * GUTTER;
      if (width <= hostBox.width) {
        setStyle(null);
        return;
      }
      setStyle({
        marginLeft: areaBox.left + GUTTER - hostBox.left,
        width,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(area);
    observer.observe(host);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [wrapperRef, expanded]);

  return style;
};
