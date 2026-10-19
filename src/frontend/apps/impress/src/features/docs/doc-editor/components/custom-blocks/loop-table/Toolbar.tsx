import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import { Popover } from './Popover';
import { operatorLabel, operatorNeedsValue } from './columnTypes';
import { labelOptionsOf } from './format';
import {
  ColumnType,
  FilterOperator,
  FilterRule,
  TableSnapshot,
  newId,
  setView,
} from './model';
import { useLoopTableUiStore } from './tableMenu';
import { operatorsFor } from './view';

interface ToolbarProps {
  table: Y.Map<unknown>;
  tableId: string;
  snapshot: TableSnapshot;
  isEditable: boolean;
  shownRows: number;
}

const FilterValueInput = ({
  rule,
  snapshot,
  onChange,
}: {
  rule: FilterRule;
  snapshot: TableSnapshot;
  onChange: (value: string) => void;
}) => {
  const column = snapshot.columns.find((item) => item.id === rule.columnId);
  if (!column || !operatorNeedsValue(rule.operator)) {
    return null;
  }
  if (column.type === ColumnType.LABEL) {
    return (
      <select
        value={rule.value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="" />
        {labelOptionsOf(column, snapshot).map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={
        column.type === ColumnType.DATE
          ? 'date'
          : column.type === ColumnType.NUMBER
            ? 'number'
            : 'text'
      }
      value={rule.value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      style={{ width: 130 }}
    />
  );
};

export const Toolbar = ({
  table,
  snapshot,
  isEditable,
  shownRows,
  tableId,
}: ToolbarProps) => {
  const { t } = useTranslation();
  // The filter panel
  const [open, setOpen] = useState(false);
  const { filters, sort } = snapshot.view;
  const visibleColumns = snapshot.columns.filter((column) => !column.hidden);

  const setFilters = (next: FilterRule[]) => setView(table, { filters: next });
  const updateRule = (id: string, changes: Partial<FilterRule>) =>
    setFilters(
      filters.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    );
  const sortColumn = snapshot.columns.find((c) => c.id === sort?.columnId);

  // The block's "⋮⋮" menu asks for the filter panel of this table
  const filterFor = useLoopTableUiStore((state) => state.filterFor);
  useEffect(() => {
    if (filterFor === tableId) {
      setOpen(true);
      useLoopTableUiStore.getState().clearFilterRequest();
    }
  }, [filterFor, tableId]);

  // Nothing to show: only the place the filter panel opens from
  if (!open && !filters.length && !sort) {
    return <div className="loop-table__toolbar-anchor" />;
  }

  return (
    <div className="loop-table__toolbar" role="toolbar">
      <div style={{ position: 'relative' }}>
        {open && (
          <Popover
            onClose={() => setOpen(false)}
            label={t('Filter rows', { description: 'Loop table filter panel' })}
          >
            {filters.length === 0 && (
              <div className="loop-table__muted" style={{ marginBottom: 6 }}>
                {t('Only rows matching every rule are shown, for everyone.', {
                  description: 'Explanation of Loop table filters',
                })}
              </div>
            )}
            {filters.map((rule, index) => {
              const column = snapshot.columns.find(
                (item) => item.id === rule.columnId,
              );
              return (
                <div key={rule.id} className="loop-table__filter-rule">
                  <span className="loop-table__muted" style={{ width: 36 }}>
                    {index === 0
                      ? t('Where', { description: 'Filter rule prefix' })
                      : t('and', { description: 'Filter rule joiner' })}
                  </span>
                  <select
                    value={rule.columnId}
                    aria-label={t('Column', { description: 'Filter rule' })}
                    onChange={(event) => {
                      const next = snapshot.columns.find(
                        (item) => item.id === event.target.value,
                      );
                      updateRule(rule.id, {
                        columnId: event.target.value,
                        operator: operatorsFor(
                          next?.type ?? ColumnType.TEXT,
                        )[0],
                        value: '',
                      });
                    }}
                  >
                    {snapshot.columns.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={rule.operator}
                    aria-label={t('Condition', { description: 'Filter rule' })}
                    onChange={(event) =>
                      updateRule(rule.id, {
                        operator: event.target.value as FilterOperator,
                      })
                    }
                  >
                    {operatorsFor(column?.type ?? ColumnType.TEXT).map(
                      (operator) => (
                        <option key={operator} value={operator}>
                          {operatorLabel(t, operator)}
                        </option>
                      ),
                    )}
                  </select>
                  <FilterValueInput
                    rule={rule}
                    snapshot={snapshot}
                    onChange={(value) => updateRule(rule.id, { value })}
                  />
                  <button
                    type="button"
                    className="loop-table__toolbar-button"
                    aria-label={t('Remove this rule', {
                      description: 'Filter rule',
                    })}
                    onClick={() =>
                      setFilters(filters.filter((item) => item.id !== rule.id))
                    }
                  >
                    <Icon iconName="close" $size="16px" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className="loop-table__popover-item"
              onClick={() => {
                const column = visibleColumns[0] ?? snapshot.columns[0];
                setFilters([
                  ...filters,
                  {
                    id: newId(),
                    columnId: column.id,
                    operator: operatorsFor(column.type)[0],
                    value: '',
                  },
                ]);
              }}
            >
              <Icon iconName="add" $size="18px" />
              {t('Add a rule', { description: 'Filter panel' })}
            </button>
            {snapshot.columns.some(
              (column) => column.type === ColumnType.PERSON,
            ) && (
              <button
                type="button"
                className="loop-table__popover-item"
                onClick={() => {
                  const column = snapshot.columns.find(
                    (item) => item.type === ColumnType.PERSON,
                  );
                  if (column) {
                    setFilters([
                      ...filters,
                      {
                        id: newId(),
                        columnId: column.id,
                        operator: 'includes_me',
                      },
                    ]);
                  }
                }}
              >
                <Icon iconName="person_pin" $size="18px" />
                {t('Assigned to me', { description: 'Filter shortcut' })}
              </button>
            )}
            {filters.length > 0 && (
              <button
                type="button"
                className="loop-table__popover-item"
                onClick={() => setFilters([])}
              >
                <Icon iconName="filter_list_off" $size="18px" />
                {t('Clear filters', { description: 'Filter panel' })}
              </button>
            )}
          </Popover>
        )}
      </div>

      {sort && sortColumn && (
        <button
          type="button"
          className="loop-table__toolbar-button is-active"
          disabled={!isEditable}
          title={t('Remove the sort', { description: 'Loop table toolbar' })}
          onClick={() => setView(table, { sort: null })}
        >
          <Icon
            iconName={
              sort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'
            }
            $size="18px"
          />
          {t('Sorted by {{name}}', {
            description: 'Loop table toolbar',
            name: sortColumn.name,
          })}
          <Icon iconName="close" $size="14px" />
        </button>
      )}

      {filters.length > 0 && (
        <button
          type="button"
          className="loop-table__toolbar-button is-active"
          disabled={!isEditable}
          title={t('Filter rows', { description: 'Loop table filter panel' })}
          onClick={() => setOpen(!open)}
        >
          <Icon iconName="filter_list" $size="18px" />
          {t('{{shown}} of {{total}} rows', {
            description: 'Loop table: rows shown by the filter',
            shown: shownRows,
            total: snapshot.rows.length,
          })}
        </button>
      )}
    </div>
  );
};
