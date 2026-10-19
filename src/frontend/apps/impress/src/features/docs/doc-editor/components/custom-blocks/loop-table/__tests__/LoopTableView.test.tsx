import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { AppWrapper } from '@/tests/utils';

import { LoopTableView } from '../LoopTableView';
import { createTable, getTable, readTable, setLayout } from '../model';

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
  return { table, container };
};

/** The number of cells in each row of the grid: header, rows, summary. */
const cellCounts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.loop-table__grid tr')).map(
    (tr) => tr.children.length,
  );

describe('LoopTableView', () => {
  it('adds rows and columns from the toolbar, the grid ending at the last column', () => {
    const { table, container } = setup();
    const { columns, rows } = readTable(table);

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    // The numbers column, then one cell per column
    expect(cellCounts(container)).toEqual(
      Array(rows.length + 2).fill(columns.length + 1),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add row' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
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
    // The corner menu, to show the numbers again, is in the toolbar
    expect(
      screen.getByRole('button', { name: 'Header and numbers' }),
    ).toBeInTheDocument();
  });

  it('gives readers neither the toolbar actions nor the row controls', () => {
    const { table, container } = setup(false);
    const { rows } = readTable(table);

    fireEvent.mouseOver(
      container.querySelector(`td[data-row-id="${rows[0].id}"]`)!,
    );
    expect(screen.queryByRole('button', { name: 'Add row' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Row 1 actions' })).toBeNull();
  });
});
