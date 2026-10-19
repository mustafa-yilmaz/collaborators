import { DropdownMenu } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import { Popover } from './Popover';
import { operatorLabel, operatorNeedsValue } from './columnTypes';
import { labelOptionsOf } from './format';
import { layoutMenuItems } from './formatMenu';
import {
  ColumnType,
  FilterOperator,
  FilterRule,
  TableSnapshot,
  addColumn,
  newId,
  setView,
  updateColumn,
} from './model';
import { operatorsFor } from './view';

interface ToolbarProps {
  table: Y.Map<unknown>;
  snapshot: TableSnapshot;
  isEditable: boolean;
  shownRows: number;
  /** Adds a row at the end and starts typing in it */
  onAddRow: () => void;
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
  onAddRow,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<
    'filter' | 'sort' | 'hidden' | 'layout' | null
  >(null);
  const { filters, sort } = snapshot.view;
  const hiddenColumns = snapshot.columns.filter((column) => column.hidden);
  const visibleColumns = snapshot.columns.filter((column) => !column.hidden);

  const setFilters = (next: FilterRule[]) => setView(table, { filters: next });
  const updateRule = (id: string, changes: Partial<FilterRule>) =>
    setFilters(
      filters.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)),
    );
  const sortColumn = snapshot.columns.find((c) => c.id === sort?.columnId);

  if (!isEditable && !filters.length && !sort) {
    return null;
  }

  return (
    <div className="loop-table__toolbar" role="toolbar">
      {isEditable && (
        <>
          <button
            type="button"
            className="loop-table__toolbar-button"
            onClick={onAddRow}
          >
            <Icon iconName="add" $size="18px" />
            {t('Add row', { description: 'Loop table toolbar' })}
          </button>
          <button
            type="button"
            className="loop-table__toolbar-button"
            onClick={() => addColumn(table, snapshot.columns.length)}
          >
            <Icon iconName="view_column" $size="18px" />
            {t('Add column', { description: 'Loop table toolbar' })}
          </button>
          <span className="loop-table__toolbar-separator" aria-hidden="true" />
        </>
      )}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          className={`loop-table__toolbar-button ${filters.length ? 'is-active' : ''}`}
          aria-expanded={open === 'filter'}
          disabled={!isEditable}
          onClick={() => setOpen(open === 'filter' ? null : 'filter')}
        >
          <Icon iconName="filter_list" $size="18px" />
          {t('Filter', { description: 'Loop table toolbar' })}
          {filters.length > 0 && (
            <span className="loop-table__badge">{filters.length}</span>
          )}
        </button>
        {open === 'filter' && (
          <Popover
            onClose={() => setOpen(null)}
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

      {hiddenColumns.length > 0 && isEditable && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="loop-table__toolbar-button"
            aria-expanded={open === 'hidden'}
            onClick={() => setOpen(open === 'hidden' ? null : 'hidden')}
          >
            <Icon iconName="visibility_off" $size="18px" />
            {t('{{count}} hidden columns', {
              description: 'Loop table toolbar',
              count: hiddenColumns.length,
            })}
          </button>
          {open === 'hidden' && (
            <Popover
              onClose={() => setOpen(null)}
              label={t('Hidden columns', { description: 'Loop table' })}
            >
              {hiddenColumns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  className="loop-table__popover-item"
                  onClick={() =>
                    updateColumn(table, column.id, { hidden: false })
                  }
                >
                  <Icon iconName="visibility" $size="18px" />
                  {t('Show {{name}}', {
                    description: 'Shows a hidden column',
                    name: column.name,
                  })}
                </button>
              ))}
            </Popover>
          )}
        </div>
      )}

      {isEditable && (
        // The corner menu, also reachable when the numbers column is hidden
        <DropdownMenu
          options={layoutMenuItems(t, table, snapshot.layout)}
          isOpen={open === 'layout'}
          onOpenChange={(isOpen) => setOpen(isOpen ? 'layout' : null)}
        >
          <button
            type="button"
            className="loop-table__toolbar-button"
            aria-expanded={open === 'layout'}
            onClick={() => setOpen(open === 'layout' ? null : 'layout')}
          >
            <Icon iconName="format_list_numbered" $size="18px" />
            {t('Header and numbers', { description: 'Loop table toolbar' })}
          </button>
        </DropdownMenu>
      )}

      {filters.length > 0 && (
        <span className="loop-table__muted">
          {t('{{shown}} of {{total}} rows', {
            description: 'Loop table: rows shown by the filter',
            shown: shownRows,
            total: snapshot.rows.length,
          })}
        </span>
      )}
    </div>
  );
};
