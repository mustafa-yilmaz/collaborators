import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { plainText } from '../mentions';
import {
  cloneTable,
  createTable,
  getTable,
  getTextCell,
  readTable,
} from '../model';
import {
  RichRun,
  docToRuns,
  readRuns,
  runsText,
  runsToDoc,
  safeLink,
  writeRuns,
} from '../richText';

const setup = () => {
  const ydoc = new Y.Doc();
  const tableId = createTable(ydoc);
  const table = getTable(ydoc, tableId)!;
  const snapshot = readTable(table);
  const rowId = snapshot.rows[0].id;
  const columnId = snapshot.columns[0].id;
  const text = getTextCell(table, rowId, columnId)!;
  return { ydoc, table, rowId, columnId, text };
};

const FORMATTED: RichRun[] = [
  { text: 'Ship ', marks: { bold: true } },
  { text: 'the ' },
  { text: 'spec', marks: { link: 'https://example.com', color: 'red' } },
  { text: '\nby @[2026-10-19](date:2026-10-19) ' },
  { text: '@[Urgent](label:red)', marks: { italic: true } },
];

describe('Rich text cells', () => {
  it('stores formatting in the Y.Text and reads it back', () => {
    const { text } = setup();

    writeRuns(text, FORMATTED);

    expect(readRuns(text)).toEqual(FORMATTED);
    // The plain text, for sorting, filters and search, has no formatting
    expect(text.toString()).toBe(runsText(FORMATTED));
  });

  it('changes only what differs', () => {
    const { text } = setup();
    writeRuns(text, [{ text: 'Hello world' }]);
    const updates: Uint8Array[] = [];
    text.doc!.on('update', (update: Uint8Array) => updates.push(update));

    writeRuns(text, [
      { text: 'Hello ' },
      { text: 'world', marks: { bold: true } },
    ]);

    expect(readRuns(text)).toEqual([
      { text: 'Hello ' },
      { text: 'world', marks: { bold: true } },
    ]);
    // Formatting only: one small update, the characters stay
    expect(updates).toHaveLength(1);
    expect(text.toString()).toBe('Hello world');

    writeRuns(text, [{ text: 'Hello world' }]);
    expect(readRuns(text)).toEqual([{ text: 'Hello world' }]);
  });

  it('goes to the cell editor and back without losing anything', () => {
    const doc = runsToDoc(FORMATTED);

    expect(docToRuns(doc)).toEqual(FORMATTED);
    // Inline elements are atoms, line breaks are breaks
    const types: string[] = [];
    doc.forEach((node) => types.push(node.type.name));
    expect(types).toContain('token');
    expect(types).toContain('hard_break');
  });

  it('reads dates, labels and images as text', () => {
    expect(
      plainText(
        'by @[2026-10-19](date:2026-10-19) @[Urgent](label:red) ' +
          '@[logo.png](image:https://x.test/logo.png) @[Ada](user:1)',
      ),
    ).toBe('by 2026-10-19 Urgent logo.png @Ada');
  });

  it('lists formatted cells in the snapshot, and copies keep them', () => {
    const { ydoc, table, rowId, columnId, text } = setup();
    writeRuns(text, FORMATTED);

    const snapshot = readTable(table);
    const row = snapshot.rows.find((item) => item.id === rowId)!;
    expect(row.rich?.[columnId]).toEqual(FORMATTED);
    expect(row.cells[columnId]).toBe(runsText(FORMATTED));
    // Cells without formatting have no runs
    expect(snapshot.rows[1].rich).toBeUndefined();

    const copy = readTable(getTable(ydoc, cloneTable(ydoc, snapshot))!);
    expect(copy.rows[0].rich?.[copy.columns[0].id]).toEqual(FORMATTED);
  });

  it('opens only safe links', () => {
    expect(safeLink('example.com/a')).toBe('https://example.com/a');
    expect(safeLink('mailto:a@b.test')).toBe('mailto:a@b.test');
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('  ')).toBeNull();
  });
});
