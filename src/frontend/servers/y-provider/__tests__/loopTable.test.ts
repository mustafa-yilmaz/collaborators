import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { docsBlockNoteSchema } from '@/blockSpecs';
import { expandLoopTables, loopTableRows } from '@/blockSpecs/LoopTable';

/** A document holding one Loop table, as the editor stores it. */
const makeDoc = () => {
  const ydoc = new Y.Doc();
  const table = new Y.Map<unknown>();
  ydoc.getMap('loop-tables').set('t1', table);

  const columns = new Y.Array<Y.Map<unknown>>();
  columns.push(
    [
      { id: 'c1', name: 'Task', type: 'text' },
      { id: 'c2', name: 'Priority', type: 'label' },
      { id: 'c3', name: 'Owner', type: 'person' },
    ].map((column) => new Y.Map(Object.entries(column))),
  );
  table.set('columns', columns);
  table.set('labelGroups', new Y.Map());

  const cells = new Y.Map<unknown>();
  cells.set('c1', new Y.Text('Write the proposal'));
  cells.set('c2', 'high');
  cells.set('c3', [{ kind: 'group', id: 'group:1', label: 'Q4 Launch' }]);
  const row = new Y.Map<unknown>();
  row.set('id', 'r1');
  row.set('cells', cells);
  const rows = new Y.Array<Y.Map<unknown>>();
  rows.push([row]);
  table.set('rows', rows);
  return ydoc;
};

describe('Loop tables in conversions', () => {
  test('reads the rows of a table as text', () => {
    expect(loopTableRows(makeDoc(), 't1')).toEqual([
      ['Task', 'Priority', 'Owner'],
      ['Write the proposal', 'High', 'Q4 Launch'],
    ]);
  });

  test('turns a loopTable block into a markdown table', async () => {
    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = expandLoopTables(
      [
        {
          id: 'b1',
          type: 'loopTable',
          props: { tableId: 't1' },
          children: [],
        },
      ],
      makeDoc(),
    );

    const markdown = await editor.blocksToMarkdownLossy(blocks as any);

    expect(markdown).toContain('Task');
    expect(markdown).toContain('Write the proposal');
    expect(markdown).toContain('Q4 Launch');
  });

  test('keeps the formatting and links of text cells', async () => {
    const ydoc = makeDoc();
    const rows = (ydoc.getMap('loop-tables').get('t1') as Y.Map<unknown>).get(
      'rows',
    ) as Y.Array<Y.Map<unknown>>;
    const text = (rows.get(0).get('cells') as Y.Map<unknown>).get(
      'c1',
    ) as Y.Text;
    text.format(0, 5, { bold: true });
    text.insert(text.length, ' by @[2026-10-19](date:2026-10-19) ', {});
    text.insert(text.length, 'spec', { link: 'https://example.com/spec' });

    const editor = ServerBlockNoteEditor.create({
      schema: docsBlockNoteSchema,
    });
    const blocks = expandLoopTables(
      [{ id: 'b1', type: 'loopTable', props: { tableId: 't1' }, children: [] }],
      ydoc,
    );
    const markdown = await editor.blocksToMarkdownLossy(blocks as any);

    expect(markdown).toContain('**Write**');
    expect(markdown).toContain('by 2026-10-19');
    expect(markdown).toContain('[spec](https://example.com/spec)');
    expect(loopTableRows(ydoc, 't1')[1][0]).toBe(
      'Write the proposal by 2026-10-19 spec',
    );
  });
});
