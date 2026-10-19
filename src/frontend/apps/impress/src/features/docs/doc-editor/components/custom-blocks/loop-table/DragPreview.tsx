import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';

import { columnTypeIcon } from './columnTypes';
import { formatCell } from './format';
import { formatStyle } from './formatMenu';
import { Column, ColumnType, Row, TableSnapshot, mergeFormats } from './model';

/** How many cells a dragged column shows under its header. */
const COLUMN_PREVIEW_ROWS = 6;

/** Columns' widths as shown in the table, by column id */
type Widths = Record<string, number>;

const widthOf = (column: Column, widths: Widths) =>
  widths[column.id] ?? column.width;

const PreviewCell = ({
  column,
  row,
  snapshot,
  width,
}: {
  column: Column;
  row: Row;
  snapshot: TableSnapshot;
  width: number;
}) => {
  const look = mergeFormats(
    row.cellFormats?.[column.id],
    row.format,
    column.format,
  );
  return (
    <td
      data-align={look.align}
      style={{ width, minWidth: width, maxWidth: width, ...formatStyle(look) }}
    >
      <div
        className={`loop-table__cell ${column.type === ColumnType.NUMBER ? 'is-number' : ''}`}
      >
        {formatCell(column, row.cells[column.id], snapshot) || ' '}
      </div>
    </td>
  );
};

/** The row being dragged, as it looks in the table, following the pointer. */
export const RowDragPreview = ({
  row,
  columns,
  snapshot,
  widths,
}: {
  row: Row;
  columns: Column[];
  snapshot: TableSnapshot;
  widths: Widths;
}) => (
  <div className="loop-table__drag-ghost" aria-hidden="true">
    <table className="loop-table__grid">
      <tbody>
        <tr>
          {columns.map((column) => (
            <PreviewCell
              key={column.id}
              column={column}
              row={row}
              snapshot={snapshot}
              width={widthOf(column, widths)}
            />
          ))}
        </tr>
      </tbody>
    </table>
  </div>
);

/**
 * The column being dragged, as it looks in the table: its header and its
 * first cells, following the pointer.
 */
export const ColumnDragPreview = ({
  column,
  rows,
  snapshot,
  widths,
}: {
  column: Column;
  rows: Row[];
  snapshot: TableSnapshot;
  widths: Widths;
}) => {
  const width = widthOf(column, widths);
  const { t } = useTranslation();
  const look = mergeFormats(snapshot.layout.header, column.format);
  const more = rows.length - COLUMN_PREVIEW_ROWS;
  return (
    <div className="loop-table__drag-ghost" aria-hidden="true">
      <table className="loop-table__grid">
        <thead>
          <tr>
            <th
              style={{
                width,
                minWidth: width,
                maxWidth: width,
                ...formatStyle(look),
              }}
            >
              <div className="loop-table__header">
                <Icon iconName={columnTypeIcon[column.type]} $size="16px" />
                <span
                  className="loop-table__header-name"
                  style={{ textAlign: look.align }}
                >
                  {column.name}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, COLUMN_PREVIEW_ROWS).map((row) => (
            <tr key={row.id}>
              <PreviewCell
                column={column}
                row={row}
                snapshot={snapshot}
                width={width}
              />
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 && (
        <div className="loop-table__drag-ghost-more">
          {t('and {{count}} more rows', {
            description: 'Under a dragged column preview',
            count: more,
          })}
        </div>
      )}
    </div>
  );
};
