import { useEffect } from 'react';

import { fetchAPI } from '@/api';

import { DocsBlockNoteEditor } from '../types';

/**
 * Collaborators: assignments anywhere in a page, besides tables' Person
 * cells. A person or a group mentioned as an assignment (`assign` on the
 * mention: set when mentioned in a to-do item, or from the mention's menu)
 * is assigned that block; ticking a to-do item off marks it done.
 *
 * The server keeps the list of what is assigned to whom (the dashboard shows
 * it), indexed by block. Each editor reports only the changes they make
 * (typing, pasting, undoing…), never collaborators' (each reports their
 * own), so the person who assigns is the one recorded.
 */

interface Assignment {
  anchor: string;
  label: string;
  kind: 'user' | 'group';
  targetId: string;
}

type InlineItem = {
  type: string;
  text?: string;
  content?: InlineItem[];
  props?: Record<string, unknown>;
};

type BlockLike = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  content?: unknown;
};

/** The block's own inline content (tables have rows of cells). */
const inlineItems = (block: BlockLike): InlineItem[] => {
  const content = block.content as
    | InlineItem[]
    | { type: 'tableContent'; rows: { cells: unknown[] }[] }
    | undefined;
  if (Array.isArray(content)) {
    return content;
  }
  if (content && content.type === 'tableContent') {
    return content.rows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        Array.isArray(cell)
          ? (cell as InlineItem[])
          : ((cell as { content?: InlineItem[] }).content ?? []),
      ),
    );
  }
  return [];
};

const plainText = (items: InlineItem[]): string =>
  items
    .map((item) => {
      if (item.type === 'text') {
        return item.text ?? '';
      }
      if (item.type === 'mention') {
        return `@${String(item.props?.label ?? '')}`;
      }
      return item.content ? plainText(item.content) : '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/** The open assignments of a block (none once a to-do item is ticked). */
export const blockAssignments = (block: BlockLike): Assignment[] => {
  if (block.type === 'checkListItem' && block.props?.checked) {
    return [];
  }
  const items = inlineItems(block);
  const label = plainText(items).slice(0, 255);
  return items
    .filter(
      (item) =>
        item.type === 'mention' &&
        item.props?.assign === true &&
        !!item.props?.targetId,
    )
    .map((item) => ({
      anchor: block.id,
      label,
      kind: item.props?.kind === 'group' ? 'group' : 'user',
      targetId: String(item.props?.targetId),
    }));
};

const keyOf = (assignment: Assignment) =>
  `${assignment.anchor}|${assignment.kind}:${assignment.targetId}`;

/** What to send for each assignment that changed: present (with its label) or gone. */
export const diffAssignments = (before: Assignment[], after: Assignment[]) => {
  const changes = new Map<string, Assignment | { gone: Assignment }>();
  const afterKeys = new Map(after.map((item) => [keyOf(item), item]));
  before.forEach((item) => {
    if (!afterKeys.has(keyOf(item))) {
      changes.set(keyOf(item), { gone: item });
    }
  });
  after.forEach((item) => {
    const previous = before.find((other) => keyOf(other) === keyOf(item));
    if (!previous || previous.label !== item.label) {
      changes.set(keyOf(item), item);
    }
  });
  return changes;
};

const FLUSH_MS = 1500;

export const usePageAssignments = (
  editor: DocsBlockNoteEditor,
  docId: string,
  canEdit: boolean,
) => {
  useEffect(() => {
    if (!canEdit) {
      return;
    }
    // The latest wish for each assignment, sent after a short pause so that
    // typing in an assigned block doesn't call the server at each key
    const pending = new Map<string, Assignment | { gone: Assignment }>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = (change: Assignment | { gone: Assignment }) => {
      const gone = 'gone' in change;
      const item = gone ? change.gone : change;
      void fetchAPI(`documents/${docId}/assignments/`, {
        method: gone ? 'DELETE' : 'POST',
        body: JSON.stringify({
          anchor_id: item.anchor,
          row_label: item.label,
          ...(item.kind === 'group'
            ? { team: item.targetId }
            : { assignee_id: item.targetId }),
        }),
      }).catch(() => undefined);
    };
    const flush = () => {
      pending.forEach(send);
      pending.clear();
    };

    const unsubscribe = editor.onChange((_editor, { getChanges }) => {
      getChanges().forEach((change) => {
        // Collaborators' own browsers report their changes
        if (change.source.type === 'yjs-remote') {
          return;
        }
        const before =
          change.type === 'insert'
            ? []
            : blockAssignments(
                change.type === 'update' ? change.prevBlock : change.block,
              );
        const after =
          change.type === 'delete' ? [] : blockAssignments(change.block);
        if (change.type === 'move') {
          return;
        }
        diffAssignments(before, after).forEach((value, key) =>
          pending.set(key, value),
        );
      });
      if (pending.size) {
        clearTimeout(timer);
        timer = setTimeout(flush, FLUSH_MS);
      }
    });

    return () => {
      clearTimeout(timer);
      flush();
      unsubscribe?.();
    };
  }, [editor, docId, canEdit]);
};
