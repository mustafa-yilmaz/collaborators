/**
 * Collaborators: how moving blocks on a page looks — the blocks being moved
 * dimmed, the page scrolling near its top and bottom edges, and the moved
 * blocks sliding to their new place, lit up for a moment.
 */

/**
 * The editor redraws its own elements when anything changes on them (a
 * class, an attribute), so the motion never touches them: the blocks being
 * moved are dimmed by a rule of this style element, and moved blocks are
 * animated (animations change no attribute).
 */
export const DRAG_SOURCES_STYLE_ID = 'bn-drag-sources';

/** The parts of a ProseMirror node read here. */
export interface NodeLike {
  type: { name: string };
  attrs: Record<string, unknown>;
  forEach: (callback: (child: NodeLike) => void) => void;
}

/** The ids of the outermost blocks among these nodes (a dragged slice). */
export const blockIdsOf = (nodes: NodeLike[]): string[] => {
  const ids: string[] = [];
  const visit = (node: NodeLike) => {
    if (node.type.name === 'blockContainer') {
      if (typeof node.attrs.id === 'string') {
        ids.push(node.attrs.id);
      }
      return;
    }
    // Groups and columns hold blocks
    node.forEach(visit);
  };
  nodes.forEach(visit);
  return ids;
};

export const blockElement = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`.bn-block-outer[data-id="${id}"]`);

/** Dims these blocks while they are being moved (none: back to normal). */
export const markDragSources = (ids: string[]) => {
  let style = document.getElementById(DRAG_SOURCES_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = DRAG_SOURCES_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = ids.length
    ? `${ids
        .map((id) => `.bn-block-outer[data-id="${id}"]`)
        .join(', ')} { opacity: 0.35; transition: opacity 120ms ease; }`
    : '';
};

/** Where the blocks are now, to slide them from there once moved. */
export const blockTops = (root: ParentNode, ids: string[]) =>
  new Map(
    ids.flatMap((id) => {
      const element = blockElement(root, id);
      return element ? [[id, element.getBoundingClientRect().top]] : [];
    }),
  );

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How many frames to wait for a move to reach the page. */
const LANDING_FRAMES = 10;

/**
 * Slides the moved blocks from where they were to their new place, and
 * lights them up for a moment. The move can reach the page a few frames
 * later (through the shared document): each block is watched until it has
 * moved. Blocks that don't move are left alone.
 */
export const animateLanding = (
  root: ParentNode,
  ids: string[],
  before: Map<string, number>,
) => {
  const land = (id: string, framesLeft: number) => {
    const element = blockElement(root, id);
    const from = before.get(id);
    if (from === undefined) {
      return;
    }
    const shift = element ? from - element.getBoundingClientRect().top : 0;
    if (!element || Math.abs(shift) < 1) {
      if (framesLeft > 0) {
        window.requestAnimationFrame(() => land(id, framesLeft - 1));
      }
      return;
    }
    if (typeof element.animate !== 'function') {
      return;
    }
    if (!prefersReducedMotion()) {
      element.animate(
        [
          { transform: `translateY(${shift}px)` },
          { transform: 'translateY(0)' },
        ],
        { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
    // A light fading out where the block landed
    element
      .querySelector<HTMLElement>(':scope > .bn-block')
      ?.animate(
        [
          { backgroundColor: 'rgba(92, 92, 230, 0.16)' },
          { backgroundColor: 'rgba(92, 92, 230, 0)' },
        ],
        { duration: 1000, easing: 'ease-out' },
      );
  };
  ids.forEach((id) =>
    window.requestAnimationFrame(() => land(id, LANDING_FRAMES)),
  );
};

/**
 * How far to scroll at each frame (negative: up) with the pointer at `y`:
 * nothing in the middle, faster the closer it gets to an edge.
 */
export const autoScrollSpeed = (
  y: number,
  top: number,
  bottom: number,
  zone = 72,
  fastest = 18,
) => {
  if (y < top + zone) {
    return -Math.ceil(fastest * Math.min(1, (top + zone - y) / zone));
  }
  if (y > bottom - zone) {
    return Math.ceil(fastest * Math.min(1, (y - (bottom - zone)) / zone));
  }
  return 0;
};

/** The page's scrolling box: the main area, else the window's. */
const scrollingBox = (container: HTMLElement | null) =>
  container && container.scrollHeight > container.clientHeight
    ? container
    : (document.scrollingElement as HTMLElement | null);

/** Scrolls the page while a block is held near its top or bottom edge. */
export const createAutoScroller = (getContainer: () => HTMLElement | null) => {
  let frame = 0;
  let pointerY: number | null = null;
  const step = () => {
    frame = 0;
    const box = scrollingBox(getContainer());
    if (!box || pointerY === null) {
      return;
    }
    const isWindow = box === document.scrollingElement;
    const rect = box.getBoundingClientRect();
    const speed = autoScrollSpeed(
      pointerY,
      isWindow ? 0 : Math.max(rect.top, 0),
      isWindow ? window.innerHeight : Math.min(rect.bottom, window.innerHeight),
    );
    if (speed) {
      box.scrollTop += speed;
      frame = window.requestAnimationFrame(step);
    }
  };
  return {
    update(clientY: number) {
      pointerY = clientY;
      if (!frame) {
        frame = window.requestAnimationFrame(step);
      }
    },
    stop() {
      pointerY = null;
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = 0;
    },
  };
};

/** Whether a block dropped at `y` over a block goes before or after it. */
export const dropPlacement = (
  y: number,
  rect: { top: number; height: number },
): 'before' | 'after' => (y < rect.top + rect.height / 2 ? 'before' : 'after');
