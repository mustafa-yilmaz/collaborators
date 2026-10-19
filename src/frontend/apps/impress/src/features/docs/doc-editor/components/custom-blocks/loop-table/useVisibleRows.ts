import {
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Below this many rows, every row is drawn. */
export const VIRTUAL_FROM = 150;
/** Rows drawn above and below the screen, for smooth scrolling. */
const OVERSCAN = 20;
/** The height of a row before any was measured. */
const ESTIMATED_ROW_HEIGHT = 37;

export interface RowWindow {
  /** Whether only some rows are drawn */
  isVirtual: boolean;
  start: number;
  end: number;
  /** The room taken by the rows not drawn, above and below */
  above: number;
  below: number;
  /** Scroll the page so that this row is drawn and on screen */
  reveal: (index: number) => void;
}

/** The element that scrolls the page, or the window. */
const scrollParentOf = (element: HTMLElement): HTMLElement | null => {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

/**
 * Smooth tables with 1,000+ rows (T56): only the rows on screen (and a few
 * around them) are drawn; the others are replaced by empty room of their
 * height, so that the page scrolls as if they were all there. Rows are
 * measured as they are drawn; the ones never drawn count as the average.
 */
export const useVisibleRows = (
  bodyRef: RefObject<HTMLTableSectionElement | null>,
  count: number,
): RowWindow => {
  const isVirtual = count > VIRTUAL_FROM;
  const rowHeight = useRef(ESTIMATED_ROW_HEIGHT);
  // Before the first measure, a screenful at the top
  const [range, setRange] = useState({
    start: 0,
    end: isVirtual ? 2 * OVERSCAN : count,
  });

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) {
      return null;
    }
    const drawn = Array.from(
      body.querySelectorAll<HTMLTableRowElement>('tr[data-row-id]'),
    );
    if (drawn.length) {
      const total = drawn.reduce((sum, row) => sum + row.offsetHeight, 0);
      rowHeight.current = Math.max(20, total / drawn.length);
    }
    return { body, scroller: scrollParentOf(body) };
  }, [bodyRef]);

  const update = useCallback(() => {
    const found = measure();
    if (!found) {
      return;
    }
    const { body, scroller } = found;
    const bodyTop = body.getBoundingClientRect().top;
    const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
    const viewBottom = scroller
      ? scroller.getBoundingClientRect().bottom
      : window.innerHeight;
    const height = rowHeight.current;
    // Where the screen is, measured from the top of the first row
    const from = viewTop - bodyTop;
    const to = viewBottom - bodyTop;
    const start = Math.max(0, Math.floor(from / height) - OVERSCAN);
    const end = Math.min(count, Math.ceil(to / height) + OVERSCAN);
    setRange((current) =>
      current.start === start && current.end === end
        ? current
        : { start, end: Math.max(end, start) },
    );
  }, [measure, count]);

  useLayoutEffect(() => {
    if (!isVirtual) {
      setRange({ start: 0, end: count });
      return;
    }
    update();
    const scroller = bodyRef.current ? scrollParentOf(bodyRef.current) : null;
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      target.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [isVirtual, count, update, bodyRef]);

  const reveal = useCallback(
    (index: number) => {
      const found = measure();
      if (!found) {
        return;
      }
      const { body, scroller } = found;
      const rowTop =
        body.getBoundingClientRect().top + index * rowHeight.current;
      const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
      const viewHeight = scroller ? scroller.clientHeight : window.innerHeight;
      const offset = rowTop - viewTop - viewHeight / 2;
      if (scroller) {
        scroller.scrollBy({ top: offset });
      } else {
        window.scrollBy({ top: offset });
      }
    },
    [measure],
  );

  if (!isVirtual) {
    return { isVirtual, start: 0, end: count, above: 0, below: 0, reveal };
  }
  const start = Math.min(range.start, count);
  const end = Math.min(Math.max(range.end, start), count);
  return {
    isVirtual,
    start,
    end,
    above: start * rowHeight.current,
    below: (count - end) * rowHeight.current,
    reveal,
  };
};
