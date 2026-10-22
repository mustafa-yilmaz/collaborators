import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { loopTableFormats } from '../export';
import { formatMenuItems, formatStyle, layoutMenuItems } from '../formatMenu';
import {
  CLEAR_FORMAT,
  SummaryKind,
  applyFormatPatch,
  cellLook,
  cloneTable,
  createTable,
  duplicateRow,
  getTable,
  headerLook,
  mergeFormats,
  readTable,
  setCellFormat,
  setColumnFormat,
  setHeaderCellFormat,
  setLayout,
  setLayoutFormat,
  setRowFormat,
  setView,
} from '../model';

const setup = () => {
  const ydoc = new Y.Doc();
  const tableId = createTable(ydoc);
  const table = getTable(ydoc, tableId)!;
  const snapshot = readTable(table);
  return {
    ydoc,
    table,
    columnId: snapshot.columns[0].id,
    rowId: snapshot.rows[0].id,
  };
};

interface MenuItem {
  label?: string;
  isChecked?: boolean;
  callback?: () => void;
  children?: MenuItem[];
}

const t = ((key: string) => key) as unknown as TFunction<
  'translation',
  undefined
>;

/** The entry of a menu with this label. */
const entry = (items: unknown[], label: string) =>
  (items as MenuItem[]).find((item) => item.label === label)!;

/** The ticked choices of a submenu. */
const ticked = (items: unknown[], label: string) =>
  entry(items, label)
    .children?.filter((child) => child.isChecked)
    .map((child) => child.label);

describe('Loop table formats', () => {
  it('patches a format and drops it when empty', () => {
    expect(applyFormatPatch(undefined, { background: '#fbe4e4' })).toEqual({
      background: '#fbe4e4',
    });
    expect(
      applyFormatPatch(
        { background: '#fbe4e4', align: 'center' },
        {
          background: null,
        },
      ),
    ).toEqual({ align: 'center' });
    expect(applyFormatPatch({ align: 'center' }, CLEAR_FORMAT)).toBeUndefined();
  });

  it('takes each property from the most specific format', () => {
    expect(
      mergeFormats(
        { background: '#fbe4e4' },
        { background: '#e3edf8', align: 'right' },
        { align: 'left', valign: 'bottom' },
      ),
    ).toEqual({ background: '#fbe4e4', align: 'right', valign: 'bottom' });
  });

  it('formats columns, rows, cells, the header row and the numbers', () => {
    const { table, columnId, rowId } = setup();

    setColumnFormat(table, columnId, { background: '#e6f3e8' });
    setRowFormat(table, rowId, { align: 'center', valign: 'middle' });
    setCellFormat(table, rowId, columnId, { background: '#fbf3db' });
    setLayoutFormat(table, 'header', { background: '#f1f1ef' });
    setLayoutFormat(table, 'numbers', { align: 'right' });
    setLayout(table, { showRowNumbers: false });

    const snapshot = readTable(table);
    expect(snapshot.columns[0].format).toEqual({ background: '#e6f3e8' });
    expect(snapshot.rows[0].format).toEqual({
      align: 'center',
      valign: 'middle',
    });
    expect(snapshot.rows[0].cellFormats).toEqual({
      [columnId]: { background: '#fbf3db' },
    });
    expect(snapshot.layout).toEqual({
      showRowNumbers: false,
      showSummary: false,
      expanded: false,
      showHeader: true,
      cells: {},
      header: { background: '#f1f1ef' },
      numbers: { align: 'right' },
    });

    setCellFormat(table, rowId, columnId, CLEAR_FORMAT);
    setColumnFormat(table, columnId, CLEAR_FORMAT);
    const cleared = readTable(table);
    expect(cleared.rows[0].cellFormats).toEqual({});
    expect(cleared.columns[0].format).toBeUndefined();
  });

  it('starts new tables without the row numbers', () => {
    const { table } = setup();
    expect(readTable(table).layout.showRowNumbers).toBe(false);
  });

  it('hides the header row and shows it again', () => {
    const { table } = setup();
    expect(readTable(table).layout.showHeader).toBe(true);
    setLayout(table, { showHeader: false });
    expect(readTable(table).layout.showHeader).toBe(false);
    setLayout(table, { showHeader: true });
    expect(readTable(table).layout.showHeader).toBe(true);
  });

  it('starts new tables with a gray header row, and only that row', () => {
    const { table } = setup();
    const { layout } = readTable(table);
    expect(layout.header).toEqual({ background: '#f1f1ef' });
    expect(layout.cells).toEqual({});
  });

  it('formats one header cell on its own, apart from its column', () => {
    const { table, columnId, rowId } = setup();
    const otherId = readTable(table).columns[1].id;

    setHeaderCellFormat(table, columnId, { background: '#fbe4e4' });
    setColumnFormat(table, columnId, {
      background: '#e6f3e8',
      align: 'right',
    });

    const snapshot = readTable(table);
    const [first, second] = snapshot.columns;
    // the header cell: its own colour; of the column, only its alignment
    expect(headerLook(snapshot, first)).toMatchObject({
      background: '#fbe4e4',
      align: 'right',
    });
    // the other header cell keeps the header row's gray
    expect(headerLook(snapshot, second).background).toBe('#f1f1ef');
    expect(second.id).toBe(otherId);
    // the column's cells: the column's colour, not the header cell's
    expect(cellLook(snapshot, snapshot.rows[0], first).background).toBe(
      '#e6f3e8',
    );
    expect(snapshot.rows[0].id).toBe(rowId);

    setHeaderCellFormat(table, columnId, CLEAR_FORMAT);
    expect(readTable(table).columns[0].headerFormat).toBeUndefined();
  });

  it('shows the row numbers of tables made before formats', () => {
    const { table } = setup();
    // A table made before formats has no layout at all
    table.delete('layout');
    expect(readTable(table).layout).toEqual({
      showRowNumbers: true,
      showSummary: false,
      expanded: false,
      showHeader: true,
      cells: {},
      header: {},
      numbers: {},
    });
  });

  it('keeps formats when a row is duplicated or the table copied', () => {
    const { ydoc, table, columnId, rowId } = setup();
    setRowFormat(table, rowId, { background: '#ede6f6' });
    setCellFormat(table, rowId, columnId, { align: 'right' });
    setLayout(table, { showRowNumbers: false });

    duplicateRow(table, rowId);
    const duplicated = readTable(table).rows[1];
    expect(duplicated.format).toEqual({ background: '#ede6f6' });
    expect(duplicated.cellFormats).toEqual({ [columnId]: { align: 'right' } });

    const copyId = cloneTable(ydoc, readTable(table));
    const copy = readTable(getTable(ydoc, copyId)!);
    expect(copy.rows[0].format).toEqual({ background: '#ede6f6' });
    expect(copy.layout.showRowNumbers).toBe(false);
  });

  it('gives exports the format of every cell, header row first', () => {
    const { table, columnId, rowId } = setup();
    setColumnFormat(table, columnId, { background: '#e3edf8' });
    setLayoutFormat(table, 'header', { align: 'center' });
    setCellFormat(table, rowId, columnId, { align: 'right' });

    const formats = loopTableFormats(readTable(table));

    // Collaborators: the header shows the header row's format, not the
    // column's colour (new tables have a gray header row)
    expect(formats[0][0]).toEqual({
      background: '#f1f1ef',
      align: 'center',
      valign: undefined,
    });
    expect(formats[1][0]).toEqual({
      background: '#e3edf8',
      align: 'right',
      valign: undefined,
    });
    expect(formats[2][1]).toEqual({
      background: undefined,
      align: undefined,
      valign: undefined,
    });
  });

  it('aligns the row numbers like any column: left, in the middle', () => {
    const { table } = setup();
    const menu = () =>
      entry(
        layoutMenuItems(t, table, readTable(table).layout),
        'Numbers column',
      ).children!;

    expect(ticked(menu(), 'Horizontal alignment')).toEqual(['Left']);
    expect(ticked(menu(), 'Vertical alignment')).toEqual(['Middle']);

    // Horizontal and vertical alignments hold at once
    entry(
      entry(menu(), 'Horizontal alignment').children!,
      'Right',
    ).callback?.();
    entry(entry(menu(), 'Vertical alignment').children!, 'Bottom').callback?.();
    expect(readTable(table).layout.numbers).toEqual({
      align: 'right',
      valign: 'bottom',
    });
    expect(ticked(menu(), 'Horizontal alignment')).toEqual(['Right']);
    expect(ticked(menu(), 'Vertical alignment')).toEqual(['Bottom']);
  });

  it('hides and shows the numbers column from its menu', () => {
    const { table } = setup();
    const menu = () => layoutMenuItems(t, table, readTable(table).layout);

    // New tables start without it
    entry(menu(), 'Show the numbers column').callback?.();
    expect(readTable(table).layout.showRowNumbers).toBe(true);
    entry(menu(), 'Hide the numbers column').callback?.();
    expect(readTable(table).layout.showRowNumbers).toBe(false);
  });

  it('spreads a table into the margins, and back', () => {
    const { ydoc, table } = setup();
    setLayout(table, { expanded: true });
    expect(readTable(table).layout.expanded).toBe(true);
    // A copy is spread too
    const copy = getTable(ydoc, cloneTable(ydoc, readTable(table)))!;
    expect(readTable(copy).layout.expanded).toBe(true);

    setLayout(table, { expanded: false });
    expect(readTable(table).layout.expanded).toBe(false);
  });

  it('styles text: a cell, then its row, its column, then all cells', () => {
    const { table, columnId, rowId } = setup();
    setLayoutFormat(table, 'cells', { textColor: 'blue', italic: true });
    setColumnFormat(table, columnId, { bold: true, textColor: 'red' });
    setRowFormat(table, rowId, { underline: true });
    // A cell undoes what it inherits with false
    setCellFormat(table, rowId, columnId, { bold: false });

    const snapshot = readTable(table);
    const [row, otherRow] = snapshot.rows;
    const [column, otherColumn] = snapshot.columns;
    expect(snapshot.layout.cells).toEqual({ textColor: 'blue', italic: true });
    expect(cellLook(snapshot, row, column)).toMatchObject({
      bold: false,
      italic: true,
      underline: true,
      textColor: 'red',
    });
    expect(cellLook(snapshot, otherRow, column)).toMatchObject({
      bold: true,
      textColor: 'red',
    });
    expect(cellLook(snapshot, otherRow, otherColumn)).toMatchObject({
      bold: undefined,
      italic: true,
      textColor: 'blue',
    });
    // Exports carry it too
    expect(loopTableFormats(snapshot)[1][0]).toMatchObject({
      bold: false,
      underline: true,
      textColor: 'red',
    });
  });

  it('turns text styles of a cell on and off from its menu', () => {
    const { table, columnId, rowId } = setup();
    setColumnFormat(table, columnId, { bold: true });
    const menu = () => {
      const snapshot = readTable(table);
      const row = snapshot.rows[0];
      return formatMenuItems(
        t,
        row.cellFormats?.[columnId],
        (patch) => setCellFormat(table, rowId, columnId, patch),
        { shown: mergeFormats(row.format, snapshot.columns[0].format) },
      );
    };

    // Bold comes from the column
    expect(ticked(menu(), 'Text style')).toEqual(['Bold']);
    entry(entry(menu(), 'Text style').children!, 'Bold').callback?.();
    expect(readTable(table).rows[0].cellFormats?.[columnId]).toEqual({
      bold: false,
    });
    expect(ticked(menu(), 'Text style')).toEqual([]);
    // Ticked again: it only repeats the column, so nothing is kept
    entry(entry(menu(), 'Text style').children!, 'Bold').callback?.();
    expect(readTable(table).rows[0].cellFormats?.[columnId]).toBeUndefined();

    entry(entry(menu(), 'Text style').children!, 'Italic').callback?.();
    entry(entry(menu(), 'Text colour').children!, 'Green').callback?.();
    expect(readTable(table).rows[0].cellFormats?.[columnId]).toEqual({
      italic: true,
      textColor: 'green',
    });
    expect(ticked(menu(), 'Text colour')).toEqual(['Green']);
    entry(menu(), 'Clear formatting').callback?.();
    expect(readTable(table).rows[0].cellFormats?.[columnId]).toBeUndefined();
  });

  it('formats all cells, and the header row is bold unless chosen', () => {
    const { table } = setup();
    const menu = () => layoutMenuItems(t, table, readTable(table).layout);
    const allCells = () => entry(menu(), 'All cells').children!;
    const header = () => entry(menu(), 'Header row').children!;

    entry(entry(allCells(), 'Text colour').children!, 'Purple').callback?.();
    entry(entry(allCells(), 'Text style').children!, 'Underline').callback?.();
    expect(readTable(table).layout.cells).toEqual({
      textColor: 'purple',
      underline: true,
    });

    expect(ticked(header(), 'Text style')).toEqual(['Bold']);
    entry(entry(header(), 'Text style').children!, 'Bold').callback?.();
    expect(readTable(table).layout.header).toEqual({
      background: '#f1f1ef',
      bold: false,
    });

    entry(allCells(), 'Clear the formatting of all cells').callback?.();
    expect(readTable(table).layout.cells).toEqual({});
  });

  it('turns a format into the styles of a cell', () => {
    expect(
      formatStyle({
        bold: true,
        italic: false,
        underline: true,
        strike: true,
        textColor: 'red',
      }),
    ).toMatchObject({
      fontWeight: 600,
      fontStyle: 'normal',
      textDecoration: 'underline line-through',
      color: '#d44c47',
    });
    expect(formatStyle({ underline: false })).toMatchObject({
      textDecoration: 'none',
      fontWeight: undefined,
      color: undefined,
    });
  });

  it('adds the summary row from the menu; new tables have none', () => {
    const { ydoc, table } = setup();
    const menu = () => layoutMenuItems(t, table, readTable(table).layout);
    expect(readTable(table).layout.showSummary).toBe(false);

    entry(menu(), 'Add a summary row').callback?.();
    expect(readTable(table).layout.showSummary).toBe(true);
    // A copy has it too
    const copy = getTable(ydoc, cloneTable(ydoc, readTable(table)))!;
    expect(readTable(copy).layout.showSummary).toBe(true);

    entry(menu(), 'Remove the summary row').callback?.();
    expect(readTable(table).layout.showSummary).toBe(false);
  });

  it('keeps the summary row of older tables where one was chosen', () => {
    const { table, columnId } = setup();
    const layout = table.get('layout') as Y.Map<unknown>;
    layout.delete('showSummary');
    expect(readTable(table).layout.showSummary).toBe(false);

    setView(table, { summaries: { [columnId]: SummaryKind.COUNT } });
    expect(readTable(table).layout.showSummary).toBe(true);
  });
});
