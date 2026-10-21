import { describe, expect, it } from 'vitest';

import { blockAssignments, diffAssignments } from '../usePageAssignments';

const mention = (targetId: string, assign: boolean, kind = 'user') => ({
  type: 'mention',
  props: { kind, targetId, label: targetId.toUpperCase(), assign },
});

const todo = (checked: boolean, content: unknown[]) => ({
  id: 'b-1',
  type: 'checkListItem',
  props: { checked },
  content,
});

describe('page assignments', () => {
  it('assigns the block to the mentions marked as assignments', () => {
    const block = todo(false, [
      { type: 'text', text: 'Book the room ' },
      mention('u-1', true),
      { type: 'text', text: ' with ' },
      mention('u-2', false),
      mention('group:g-1', true, 'group'),
    ]);

    expect(blockAssignments(block)).toEqual([
      {
        anchor: 'b-1',
        label: 'Book the room @U-1 with @U-2@GROUP:G-1',
        kind: 'user',
        targetId: 'u-1',
      },
      {
        anchor: 'b-1',
        label: 'Book the room @U-1 with @U-2@GROUP:G-1',
        kind: 'group',
        targetId: 'group:g-1',
      },
    ]);
  });

  it('a ticked to-do item is done: no assignment left', () => {
    expect(blockAssignments(todo(true, [mention('u-1', true)]))).toEqual([]);
  });

  it('works in any block, tables included', () => {
    expect(
      blockAssignments({
        id: 'p-1',
        type: 'paragraph',
        content: [mention('u-1', true)],
      }),
    ).toHaveLength(1);
    expect(
      blockAssignments({
        id: 't-1',
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [{ cells: [{ content: [mention('u-1', true)] }] }],
        },
      }),
    ).toHaveLength(1);
  });

  it('sends what was added, renamed or removed, nothing else', () => {
    const one = blockAssignments(todo(false, [mention('u-1', true)]));
    const renamed = blockAssignments(
      todo(false, [{ type: 'text', text: 'Call ' }, mention('u-1', true)]),
    );
    const two = blockAssignments(
      todo(false, [mention('u-1', true), mention('u-2', true)]),
    );

    expect(diffAssignments(one, one).size).toBe(0);
    expect([...diffAssignments(one, renamed).values()]).toEqual(renamed);
    // Bob added: his assignment, and Ada's with the item's new text
    expect([...diffAssignments(one, two).keys()]).toEqual([
      'b-1|user:u-1',
      'b-1|user:u-2',
    ]);
    // Bob removed: his assignment goes, Ada's text changes back
    expect([...diffAssignments(two, one).values()]).toEqual([
      { gone: two[1] },
      one[0],
    ]);
  });
});
