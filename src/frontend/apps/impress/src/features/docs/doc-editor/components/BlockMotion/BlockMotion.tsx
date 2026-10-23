import { SideMenuExtension } from '@blocknote/core/extensions';
import { useBlockNoteEditor, useExtensionState } from '@blocknote/react';
import { useEffect, useRef } from 'react';

import { MAIN_LAYOUT_ID } from '@/layouts/conf';

import type {
  DocsBlockSchema,
  DocsInlineContentSchema,
  DocsStyleSchema,
} from '../../types';

import {
  NodeLike,
  animateLanding,
  blockElement,
  blockIdsOf,
  blockTops,
  createAutoScroller,
  dropPlacement,
  markDragSources,
} from './motion';

/** How long a finger rests on a block's "⠿" before it picks the block up. */
const HOLD_MS = 400;
/** How far a finger may wander while resting. */
const HOLD_SLOP = 10;

const HANDLE = '.bn-side-menu [draggable="true"]';

interface TouchDrag {
  id: string;
  startX: number;
  startY: number;
  timer: number;
  isActive: boolean;
  offsetY: number;
  preview?: HTMLElement;
  line?: HTMLElement;
  target?: { id: string; placement: 'before' | 'after' };
}

/**
 * Collaborators: makes moving blocks on a page smoother, around BlockNote's
 * own dragging by the "⠿" handle:
 * - the blocks being dragged are dimmed, and the page scrolls when they are
 *   held near its top or bottom edge;
 * - moved blocks (dragged, or moved with ⌘/Ctrl ⇧ ↑/↓) slide to their new
 *   place and light up for a moment;
 * - on touch screens, a finger resting on the "⠿" picks the block up, and
 *   lifting it drops the block where the line shows.
 */
export const BlockMotion = () => {
  const editor = useBlockNoteEditor<
    DocsBlockSchema,
    DocsInlineContentSchema,
    DocsStyleSchema
  >();
  const sideMenuBlockId = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block?.id,
  });
  const sideMenuBlockIdRef = useRef(sideMenuBlockId);
  sideMenuBlockIdRef.current = sideMenuBlockId;

  useEffect(() => {
    // The editor's page, once mounted
    const page = () => editor.domElement;
    const scroller = createAutoScroller(() =>
      document.getElementById(MAIN_LAYOUT_ID),
    );

    // -- Dragging with a mouse (BlockNote's own drag)
    let dragged: string[] = [];
    let touch: TouchDrag | null = null;

    const selectedBlockIds = () => {
      const nodes: NodeLike[] = [];
      editor.prosemirrorView.state.selection
        .content()
        .content.forEach((node) => nodes.push(node));
      return blockIdsOf(nodes);
    };

    // After BlockNote's handler, which selects the dragged blocks
    const onDragStart = (event: DragEvent) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('.bn-side-menu')
      ) {
        return;
      }
      const root = page();
      if (!root) {
        return;
      }
      dragged = selectedBlockIds();
      markDragSources(dragged);
    };
    const onDragOver = (event: DragEvent) => {
      if (dragged.length) {
        scroller.update(event.clientY);
      }
    };
    // Before the editor handles the drop: where the blocks were
    const onDrop = () => {
      const root = page();
      if (root && dragged.length) {
        animateLanding(root, dragged, blockTops(root, dragged));
      }
    };
    const onDragEnd = () => {
      markDragSources([]);
      dragged = [];
      scroller.stop();
    };

    // A finger picks blocks up our way, not with the browser's own drag
    // (before BlockNote's handler, which would take it as its drag)
    const onTouchDragStart = (event: DragEvent) => {
      if (touch) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // -- Moving with the keyboard (BlockNote's ⌘/Ctrl ⇧ ↑/↓)
    const onKeyDown = (event: KeyboardEvent) => {
      const root = page();
      if (
        !root ||
        !(event.target instanceof Node) ||
        !root.contains(event.target) ||
        !event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
      ) {
        return;
      }
      const ids = editor.getSelection()?.blocks.map((block) => block.id) ?? [
        editor.getTextCursorPosition().block.id,
      ];
      animateLanding(root, ids, blockTops(root, ids));
    };

    // -- Touch screens: rest a finger on the "⠿", then move it

    const endTouch = () => {
      if (!touch) {
        return;
      }
      window.clearTimeout(touch.timer);
      touch.preview?.remove();
      touch.line?.remove();
      markDragSources([]);
      scroller.stop();
      touch = null;
    };

    const pickUp = () => {
      const current = touch;
      const root = page();
      const element = current && root && blockElement(root, current.id);
      if (!current || !root || !element) {
        endTouch();
        return;
      }
      current.isActive = true;
      const rect = element.getBoundingClientRect();
      current.offsetY = current.startY - rect.top;
      // A copy of the block follows the finger
      const preview = document.createElement('div');
      // The editor's look, but not its own classes (BlockNote looks for
      // its editors by them), as in its own drag preview
      preview.className = `bn-touch-drag-preview ${root.className
        .split(' ')
        .filter(
          (name) =>
            !['ProseMirror', 'tiptap', 'bn-editor', 'bn-root'].includes(name),
        )
        .join(' ')}`;
      preview.style.left = `${rect.left}px`;
      preview.style.top = `${rect.top}px`;
      preview.style.width = `${rect.width}px`;
      preview.appendChild(element.cloneNode(true));
      const line = document.createElement('div');
      line.className = 'bn-touch-drop-line';
      line.hidden = true;
      const container = root.closest('.bn-container') ?? document.body;
      container.append(preview, line);
      current.preview = preview;
      current.line = line;
      markDragSources([current.id]);
      navigator.vibrate?.(15);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.pointerType !== 'touch' ||
        !(event.target instanceof Element) ||
        !event.target.closest(HANDLE) ||
        !sideMenuBlockIdRef.current ||
        !editor.isEditable
      ) {
        return;
      }
      endTouch();
      touch = {
        id: sideMenuBlockIdRef.current,
        startX: event.clientX,
        startY: event.clientY,
        timer: window.setTimeout(pickUp, HOLD_MS),
        isActive: false,
        offsetY: 0,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!touch) {
        return;
      }
      if (!touch.isActive) {
        if (
          Math.hypot(
            event.clientX - touch.startX,
            event.clientY - touch.startY,
          ) > HOLD_SLOP
        ) {
          endTouch();
        }
        return;
      }
      event.preventDefault();
      const { preview, line } = touch;
      if (preview) {
        preview.style.top = `${event.clientY - touch.offsetY}px`;
      }
      scroller.update(event.clientY);
      const root = page();
      if (!root) {
        return;
      }
      // The block under the finger, not the one being moved
      const source = blockElement(root, touch.id);
      const over = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('.bn-block-outer');
      if (!over || !root.contains(over) || source?.contains(over)) {
        return;
      }
      const rect = over.getBoundingClientRect();
      const placement = dropPlacement(event.clientY, rect);
      touch.target = { id: over.dataset.id ?? '', placement };
      if (line) {
        line.hidden = false;
        line.style.left = `${rect.left}px`;
        line.style.width = `${rect.width}px`;
        line.style.top = `${(placement === 'before' ? rect.top : rect.bottom) - 1.5}px`;
      }
    };

    const onPointerUp = () => {
      const current = touch;
      if (!current) {
        return;
      }
      if (!current.isActive) {
        // A tap: the "⠿" opens its menu as usual
        endTouch();
        return;
      }
      // Lifting the finger isn't a tap on the "⠿"
      const swallowClick = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener('click', swallowClick, {
        capture: true,
        once: true,
      });
      window.setTimeout(
        () => window.removeEventListener('click', swallowClick, true),
        500,
      );
      const target = current.target;
      const block = editor.getBlock(current.id);
      const root = page();
      const before = root
        ? blockTops(root, [current.id])
        : new Map<string, number>();
      // The copy and the line go first, then the block moves
      endTouch();
      if (root && target?.id && target.id !== current.id && block) {
        const [moved] = editor.transact(() => {
          editor.removeBlocks([current.id]);
          return editor.insertBlocks([block], target.id, target.placement);
        });
        // The block may come back under a new id
        const from = before.get(current.id);
        if (moved && from !== undefined) {
          animateLanding(root, [moved.id], new Map([[moved.id, from]]));
        }
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(HANDLE)) {
        event.preventDefault();
      }
    };

    window.addEventListener('dragstart', onTouchDragStart, true);
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop, true);
    document.addEventListener('dragend', onDragEnd);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove, {
      capture: true,
      passive: false,
    });
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', endTouch, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      endTouch();
      scroller.stop();
      window.removeEventListener('dragstart', onTouchDragStart, true);
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop, true);
      document.removeEventListener('dragend', onDragEnd);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', endTouch, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [editor]);

  return null;
};
