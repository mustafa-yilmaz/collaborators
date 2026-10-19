import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Popover } from './Popover';
import { summaryLabel } from './columnTypes';
import { formatNumber } from './format';
import {
  Column,
  ColumnType,
  Row,
  SummaryKind,
  TableSnapshot,
  setView,
} from './model';
import { defaultSummary, summarize, summaryKindsFor } from './view';

interface SummaryRowProps {
  table: Y.Map<unknown>;
  snapshot: TableSnapshot;
  columns: Column[];
  rows: Row[];
  isEditable: boolean;
  /** Whether the table shows its numbers column, on the left */
  withNumbersColumn?: boolean;
}

/** Sum, average, count... per column, under the rows shown. */
export const SummaryRow = ({
  table,
  snapshot,
  columns,
  rows,
  isEditable,
  withNumbersColumn = true,
}: SummaryRowProps) => {
  const { t } = useTranslation();
  const [openColumnId, setOpenColumnId] = useState<string | null>(null);

  return (
    <tr className="loop-table__summary">
      {withNumbersColumn && <td />}
      {columns.map((column) => {
        const kind =
          snapshot.view.summaries[column.id] ?? defaultSummary(column.type);
        const result = summarize(column, rows, kind);
        let text = '';
        if (column.type === ColumnType.PERSON && kind === SummaryKind.COUNT) {
          text = (result.perPerson ?? [])
            .map((item) => `${item.label} ${item.count}`)
            .join(' · ');
        } else if (result.value !== null && kind !== SummaryKind.NONE) {
          const value =
            column.type === ColumnType.NUMBER && kind !== SummaryKind.COUNT
              ? formatNumber(result.value, column.numberFormat, column.currency)
              : result.value.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                });
          text = `${summaryLabel(t, kind)} ${value}`;
        }

        return (
          <td key={column.id} style={{ position: 'relative' }}>
            <button
              type="button"
              className={`loop-table__summary-button ${column.type === ColumnType.NUMBER ? '' : 'is-left'}`}
              disabled={!isEditable}
              aria-label={t('Summary of {{name}}: {{value}}', {
                description: 'Accessible name of a summary cell',
                name: column.name,
                value: text || summaryLabel(t, SummaryKind.NONE),
              })}
              onClick={() =>
                setOpenColumnId(openColumnId === column.id ? null : column.id)
              }
            >
              {text || (isEditable ? ' ' : '')}
            </button>
            {openColumnId === column.id && (
              <Popover
                onClose={() => setOpenColumnId(null)}
                label={t('Summary', { description: 'Loop table summary' })}
              >
                {summaryKindsFor(column.type).map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    autoFocus={index === 0}
                    className="loop-table__popover-item"
                    onClick={() => {
                      setView(table, {
                        summaries: {
                          ...snapshot.view.summaries,
                          [column.id]: item,
                        },
                      });
                      setOpenColumnId(null);
                    }}
                  >
                    {summaryLabel(t, item)}
                    {kind === item ? ' ✓' : ''}
                  </button>
                ))}
              </Popover>
            )}
          </td>
        );
      })}
      {isEditable && <td />}
    </tr>
  );
};
