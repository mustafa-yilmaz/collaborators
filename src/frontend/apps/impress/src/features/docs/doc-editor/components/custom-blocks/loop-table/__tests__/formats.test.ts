import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { loopTableFormats } from '../export';
import {
  CLEAR_FORMAT,
  applyFormatPatch,
  cloneTable,
  createTable,
  duplicateRow,
  getTable,
  mergeFormats,
  readTable,
  setCellFormat,
  setColumnFormat,
  setLayout,
  setLayoutFormat,
  setRowFormat,
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
      header: { background: '#f1f1ef' },
      numbers: { align: 'right' },
    });

    setCellFormat(table, rowId, columnId, CLEAR_FORMAT);
    setColumnFormat(table, columnId, CLEAR_FORMAT);
    const cleared = readTable(table);
    expect(cleared.rows[0].cellFormats).toEqual({});
    expect(cleared.columns[0].format).toBeUndefined();
  });

  it('shows the row numbers of tables made before formats', () => {
    const { table } = setup();
    expect(readTable(table).layout).toEqual({
      showRowNumbers: true,
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

    expect(formats[0][0]).toEqual({
      background: '#e3edf8',
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
});
