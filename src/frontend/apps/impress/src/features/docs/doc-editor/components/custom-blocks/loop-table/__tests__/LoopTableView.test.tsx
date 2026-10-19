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
  const { container } = render(
    <LoopTableView ydoc={ydoc} tableId={tableId} isEditable={isEditable} />,
    { wrapper: AppWrapper },
  );
  return { table, tableId, container };
};

/** The number of cells in each row of the grid: header, rows, summary. */
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
    // The numbers column, then one cell per column
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 2).fill(columns.length + 1),
    );

    expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();
    chooseInTableMenu(table, tableId, 'Add row');
    chooseInTableMenu(table, tableId, 'Add column');
    expect(readTable(table).rows).toHaveLength(rows.length + 1);
    expect(readTable(table).columns).toHaveLength(columns.length + 1);
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 3).fill(columns.length + 2),
    );
  });

  it('hides the numbers column for editors too, rows keeping their menu', () => {
    const { table, container } = setup();
    act(() => setLayout(table, { showRowNumbers: false }));
    const { columns, rows } = readTable(table);

    expect(container.querySelector('.loop-table__rownum')).toBeNull();
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 2).fill(columns.length),
    );

    // The row's handle and menu show beside the row under the pointer
    fireEvent.mouseOver(
      container.querySelector(`td[data-row-id="${rows[1].id}"]`)!,
    );
    expect(
      screen.getByRole('button', { name: 'Row 2 actions' }),
    ).toBeInTheDocument();
    // The table menu shows the numbers again
    const layout = tableMenuItems(
      ((key: string) => key) as never,
      table,
      'id',
      readTable(table),
    ).find((entry) => 'label' in entry && entry.label === 'Numbers column');
    expect(
      (layout as { children: { label: string }[] }).children[0].label,
    ).toBe('Show the numbers column');
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
      container.querySelector('tbody tr[data-row-id] .loop-table__rownum')
        ?.textContent,
    ).toBe('1');
  });
});
