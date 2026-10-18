import * as Y from 'yjs';

import { addColumn, addRow, setTextCell } from './model';
import { useLoopTable } from './useLoopTable';

interface LoopTableViewProps {
  ydoc: Y.Doc | null;
  tableId: string;
  isEditable: boolean;
}

/** Spike view: text cells only, to check sync, persistence and history. */
export const LoopTableView = ({
  ydoc,
  tableId,
  isEditable,
}: LoopTableViewProps) => {
  const { table, snapshot } = useLoopTable(ydoc, tableId);

  if (!table || !snapshot) {
    return <div contentEditable={false}>Loading table…</div>;
  }

  return (
    <div
      contentEditable={false}
      onKeyDown={(event) => event.stopPropagation()}
      data-testid="loop-table"
    >
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {snapshot.columns.map((column) => (
              <th key={column.id} style={{ border: '1px solid #ccc' }}>
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshot.rows.map((row) => (
            <tr key={row.id}>
              {snapshot.columns.map((column) => (
                <td key={column.id} style={{ border: '1px solid #ccc' }}>
                  <input
                    value={String(row.cells[column.id] ?? '')}
                    readOnly={!isEditable}
                    onChange={(event) =>
                      setTextCell(table, row.id, column.id, event.target.value)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {isEditable && (
        <>
          <button onClick={() => addRow(table)}>+ row</button>
          <button onClick={() => addColumn(table, snapshot.columns.length)}>
            + column
          </button>
        </>
      )}
    </div>
  );
};
