import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { AppWrapper } from '@/tests/utils';

import { LoopTableView } from '../LoopTableView';
import { addRow, createTable, getTable, readTable, setLayout } from '../model';
import { tableMenuItems } from '../tableMenu';

vi.mock('@/features/auth', () => ({
  useAuth: () => ({ user: undefined }),
}));

const setup = (isEditable = true) => {
  const ydoc = new Y.Doc();
  const tableId = createTable(ydoc);
  const table = getTable(ydoc, tableId)!;
  // These tests go through the numbers column, hidden in new tables
  setLayout(table, { showRowNumbers: true });
  const { container } = render(
    <LoopTableView ydoc={ydoc} tableId={tableId} isEditable={isEditable} />,
    { wrapper: AppWrapper },
  );
  return { table, tableId, container };
};

/** The number of cells in each row of the grid: header, rows, summary if any. */
const cellCounts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.loop-table__grid tr')).map(
    (tr) => tr.children.length,
  );

/** Choose an entry of the table's menu (in its block's "⋮⋮" menu). */
const chooseInTableMenu = (
  table: Y.Map<unknown>,
  tableId: string,
  label: string,
) => {
  const item = tableMenuItems(
    ((key: string) => key) as never,
    table,
    tableId,
    readTable(table),
  ).find((entry) => 'label' in entry && entry.label === label);
  act(() => (item as { callback: () => void }).callback());
};

describe('LoopTableView', () => {
  it('adds rows and columns from the table menu, the grid ending at the last column', () => {
    const { table, tableId, container } = setup();
    const { columns, rows } = readTable(table);

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    // The numbers column, then one cell per column; no summary row yet
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 1).fill(columns.length + 1),
    );

    expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();
    chooseInTableMenu(table, tableId, 'Add row');
    chooseInTableMenu(table, tableId, 'Add column');
    expect(readTable(table).rows).toHaveLength(rows.length + 1);
    expect(readTable(table).columns).toHaveLength(columns.length + 1);
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 2).fill(columns.length + 2),
    );

    // The summary row is added from the menu, and taken away
    chooseInTableMenu(table, tableId, 'Add a summary row');
    expect(container.querySelector('.loop-table__summary')).not.toBeNull();
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 3).fill(columns.length + 2),
    );
    chooseInTableMenu(table, tableId, 'Remove the summary row');
    expect(container.querySelector('.loop-table__summary')).toBeNull();
  });

  it('hides the numbers column for editors too, rows keeping their menu', () => {
    const { table, container } = setup();
    act(() => setLayout(table, { showRowNumbers: false }));
    const { columns, rows } = readTable(table);

    expect(container.querySelector('.loop-table__rownum')).toBeNull();
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 1).fill(columns.length),
    );

    // The row's handle and menu show beside the row under the pointer
    fireEvent.mouseOver(
      container.querySelector(`td[data-row-id="${rows[1].id}"]`)!,
    );
    expect(
      screen.getByRole('button', { name: 'Row 2 actions' }),
    ).toBeInTheDocument();
    // The table menu shows the numbers again (and the header row hides)
    const labels = tableMenuItems(
      ((key: string) => key) as never,
      table,
      'id',
      readTable(table),
    ).map((entry) => ('label' in entry ? entry.label : '-'));
    expect(labels.slice(-3)).toEqual([
      'All cells',
      'Hide the header row',
      'Show the numbers column',
    ]);
  });

  it('formats the cells of the numbers column from their "⌄", never typing in them', () => {
    const { table, container } = setup();
    const { rows } = readTable(table);
    const numberCell = container.querySelector<HTMLElement>(
      'tbody td.loop-table__rownum',
    )!;

    fireEvent.click(numberCell);
    expect(numberCell.querySelector('input, [contenteditable]')).toBeNull();
    const chevron = numberCell.querySelector('.loop-table__cell-chevron');
    expect(chevron).not.toBeNull();
    fireEvent.click(chevron!);
    expect(
      screen.getByRole('menuitem', { name: /Clear cell formatting/ }),
    ).toBeInTheDocument();
    expect(rows[0].cellFormats).toBeUndefined();
  });

  it('shows no type icon beside the column names', () => {
    const { container } = setup();
    expect(
      container.querySelector('thead .loop-table__header .--docs--icon-bg'),
    ).toBeNull();
    expect(
      Array.from(container.querySelectorAll('thead .loop-table__header')).map(
        (header) => header.textContent,
      ),
    ).toEqual(['', 'Column 1', 'Column 2']);
  });

  it('gives readers neither the table menu nor the row controls', () => {
    const { table, container } = setup(false);
    const { rows } = readTable(table);

    fireEvent.mouseOver(
      container.querySelector(`td[data-row-id="${rows[0].id}"]`)!,
    );
    expect(screen.queryByRole('button', { name: 'Table options' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Row 1 actions' })).toBeNull();
  });

  it('draws only the rows on screen of a very large table', () => {
    const { table, container } = setup();
    act(() => {
      table.doc!.transact(() => {
        for (let i = 0; i < 1000; i++) {
          addRow(table);
        }
      });
    });

    const drawn = container.querySelectorAll('tbody tr[data-row-id]');
    expect(readTable(table).rows.length).toBeGreaterThan(1000);
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThan(200);
    // The rows not drawn keep their room, so the page scrolls as usual
    const spacer = container.querySelector<HTMLElement>(
      'tbody tr.loop-table__spacer',
    );
    expect(spacer).not.toBeNull();
    expect(parseFloat(spacer!.style.height)).toBeGreaterThan(10000);
    // Row numbers count from the top of the table
    expect(
      container.querySelector(
        'tbody tr[data-row-id] .loop-table__rownum-number',
      )?.textContent,
    ).toBe('1');
  });
});
