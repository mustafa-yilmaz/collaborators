import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { formatCell } from '../format';
import {
  ColumnType,
  NumberFormat,
  SummaryKind,
  addColumn,
  addRow,
  changeColumnType,
  cloneTable,
  createTable,
  deleteColumn,
  getTable,
  moveColumn,
  moveRow,
  readTable,
  setCellValue,
  setTextCell,
  setView,
  toggleVote,
} from '../model';
import { summarize, visibleRows } from '../view';

const setup = () => {
  const ydoc = new Y.Doc();
  const tableId = createTable(ydoc);
  const table = getTable(ydoc, tableId)!;
  return { ydoc, tableId, table };
};

describe('Loop table model', () => {
  it('creates a 2 by 2 text table like Loop', () => {
    const { table } = setup();
    const snapshot = readTable(table);

    expect(snapshot.columns.map((column) => column.type)).toEqual([
      ColumnType.TEXT,
      ColumnType.TEXT,
    ]);
    expect(snapshot.rows).toHaveLength(2);
    expect(snapshot.rows[0].cells[snapshot.columns[0].id]).toBe('');
  });

  it('edits text cells with the fewest changes', () => {
    const { table } = setup();
    const { rows, columns } = readTable(table);

    setTextCell(table, rows[0].id, columns[0].id, 'Hello');
    setTextCell(table, rows[0].id, columns[0].id, 'Hello Loop');

    expect(readTable(table).rows[0].cells[columns[0].id]).toBe('Hello Loop');
  });

  it('merges concurrent edits of different cells', () => {
    const { ydoc, table } = setup();
    const { rows, columns } = readTable(table);
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(ydoc));
    const otherTable = other
      .getMap<Y.Map<unknown>>('loop-tables')
      .get(Array.from(other.getMap('loop-tables').keys())[0])!;

    setTextCell(table, rows[0].id, columns[0].id, 'mine');
    setTextCell(otherTable, rows[1].id, columns[1].id, 'theirs');
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(other));
    Y.applyUpdate(other, Y.encodeStateAsUpdate(ydoc));

    expect(readTable(table)).toEqual(readTable(otherTable));
    expect(readTable(table).rows[1].cells[columns[1].id]).toBe('theirs');
  });

  it('adds, moves and deletes columns and rows', () => {
    const { table } = setup();
    const added = addColumn(table, 0, { name: 'First' });
    moveColumn(table, added, 2);
    let snapshot = readTable(table);
    expect(snapshot.columns.map((column) => column.name)).toEqual([
      'Column 1',
      'Column 2',
      'First',
    ]);

    const rowId = addRow(table, 0);
    moveRow(table, rowId, 2);
    snapshot = readTable(table);
    expect(snapshot.rows[2].id).toBe(rowId);

    deleteColumn(table, added);
    expect(readTable(table).columns).toHaveLength(2);
  });

  it('keeps what makes sense when a column changes type', () => {
    const { table } = setup();
    const { rows, columns } = readTable(table);
    setTextCell(table, rows[0].id, columns[0].id, '12,5');
    setTextCell(table, rows[1].id, columns[0].id, 'not a number');

    changeColumnType(table, columns[0].id, ColumnType.NUMBER);

    const snapshot = readTable(table);
    expect(snapshot.rows[0].cells[columns[0].id]).toBe(12.5);
    expect(snapshot.rows[1].cells[columns[0].id]).toBeNull();
  });

  it('matches label names when a column becomes a label column', () => {
    const { table } = setup();
    const { rows, columns } = readTable(table);
    setTextCell(table, rows[0].id, columns[0].id, 'high');

    changeColumnType(table, columns[0].id, ColumnType.LABEL, 'priority');

    expect(readTable(table).rows[0].cells[columns[0].id]).toBe('high');
  });

  it('counts each voter once', () => {
    const { table } = setup();
    const columnId = addColumn(table, 2, { type: ColumnType.VOTING });
    const rowId = readTable(table).rows[0].id;

    toggleVote(table, rowId, columnId, 'u1');
    toggleVote(table, rowId, columnId, 'u2');
    toggleVote(table, rowId, columnId, 'u1');

    expect(readTable(table).rows[0].cells[columnId]).toEqual(['u2']);
  });

  it('clones a table under a new id', () => {
    const { ydoc, table } = setup();
    const { rows, columns } = readTable(table);
    setTextCell(table, rows[0].id, columns[0].id, 'copied');

    const cloneId = cloneTable(ydoc, readTable(table));
    const clone = getTable(ydoc, cloneId)!;
    setTextCell(
      clone,
      readTable(clone).rows[0].id,
      readTable(clone).columns[0].id,
      'changed',
    );

    expect(readTable(table).rows[0].cells[columns[0].id]).toBe('copied');
  });
});

describe('Loop table view', () => {
  const numbers = () => {
    const { table } = setup();
    const columnId = addColumn(table, 2, {
      name: 'Budget',
      type: ColumnType.NUMBER,
      numberFormat: NumberFormat.PLAIN,
    });
    const rowIds = readTable(table).rows.map((row) => row.id);
    setCellValue(table, rowIds[0], columnId, 300);
    setCellValue(table, rowIds[1], columnId, 1200);
    addRow(table);
    return { table, columnId };
  };

  it('sorts numbers, empty cells last', () => {
    const { table, columnId } = numbers();
    setView(table, { sort: { columnId, direction: 'desc' } });

    const values = visibleRows(readTable(table)).map(
      (row) => row.cells[columnId],
    );

    expect(values).toEqual([1200, 300, null]);
  });

  it('filters rows with every rule', () => {
    const { table, columnId } = numbers();
    setView(table, {
      filters: [
        { id: 'f1', columnId, operator: 'gt', value: '500' },
        { id: 'f2', columnId, operator: 'not_empty' },
      ],
    });

    const rows = visibleRows(readTable(table));

    expect(rows.map((row) => row.cells[columnId])).toEqual([1200]);
  });

  it('finds rows assigned to me or to my groups', () => {
    const { table } = setup();
    const columnId = addColumn(table, 2, { type: ColumnType.PERSON });
    const rowIds = readTable(table).rows.map((row) => row.id);
    setCellValue(table, rowIds[0], columnId, [
      { kind: 'group', id: 'group:1', label: 'Q4' },
    ]);
    setCellValue(table, rowIds[1], columnId, [
      { kind: 'user', id: 'someone', label: 'Someone' },
    ]);
    setView(table, {
      filters: [{ id: 'f', columnId, operator: 'includes_me' }],
    });

    const rows = visibleRows(readTable(table), {
      userId: 'me',
      teams: ['group:1'],
    });

    expect(rows.map((row) => row.id)).toEqual([rowIds[0]]);
  });

  it('summarizes numbers', () => {
    const { table, columnId } = numbers();
    const snapshot = readTable(table);
    const column = snapshot.columns.find((item) => item.id === columnId)!;

    expect(summarize(column, snapshot.rows, SummaryKind.SUM).value).toBe(1500);
    expect(summarize(column, snapshot.rows, SummaryKind.AVERAGE).value).toBe(
      750,
    );
    expect(summarize(column, snapshot.rows, SummaryKind.COUNT).value).toBe(2);
    expect(summarize(column, snapshot.rows, SummaryKind.MAX).value).toBe(1200);
  });

  it('formats label and person cells as text', () => {
    const { table } = setup();
    const labelId = addColumn(table, 2, {
      type: ColumnType.LABEL,
      labelGroupId: 'priority',
    });
    const snapshot = readTable(table);
    const column = snapshot.columns.find((item) => item.id === labelId)!;

    expect(formatCell(column, 'medium', snapshot)).toBe('Medium');
    expect(
      formatCell(
        { ...column, type: ColumnType.PERSON },
        [{ kind: 'user', id: 'u', label: 'Ada' }],
        snapshot,
      ),
    ).toBe('Ada');
  });
});
