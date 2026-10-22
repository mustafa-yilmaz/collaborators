import { useDroppable } from '@dnd-kit/core';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import type { TFunction } from 'i18next';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import {
  columnTypeIcon,
  columnTypeLabel,
  numberFormatLabel,
} from './columnTypes';
import {
  HEADER_DEFAULTS,
  columnDefaults,
  formatMenuItems,
  formatStyle,
} from './formatMenu';
import {
  Column,
  ColumnType,
  NumberFormat,
  TableSnapshot,
  addColumn,
  allLabelGroups,
  changeColumnType,
  deleteColumn,
  headerLook,
  mergeFormats,
  newId,
  setColumnFormat,
  setHeaderCellFormat,
  setView,
  updateColumn,
} from './model';
import { operatorsFor } from './view';

interface ColumnHeaderProps {
  table: Y.Map<unknown>;
  snapshot: TableSnapshot;
  column: Column;
  isEditable: boolean;
  /** Where a dragged column would land: 'is-drop-before' or 'is-drop-after' */
  dropSide: string;
  isDragSource: boolean;
}

export const ColumnHeader = ({
  table,
  snapshot,
  column,
  isEditable,
  dropSide,
  isDragSource,
}: ColumnHeaderProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const startRef = useRef<{ x: number; width: number } | null>(null);

  // Collaborators: moved by its handle above the table (ColumnControls)
  const drop = useDroppable({ id: `col:${column.id}` });

  const sort = snapshot.view.sort;
  const sortedHere = sort?.columnId === column.id ? sort.direction : null;

  // Collaborators: the same menu as every other cell — this header cell's
  // own format; renaming is typing in it
  const cellMenu = formatMenuItems(
    t,
    column.headerFormat,
    (patch) => setHeaderCellFormat(table, column.id, patch),
    {
      // What it inherits from the header row, then the defaults
      shown: mergeFormats(snapshot.layout.header, HEADER_DEFAULTS),
      labels: {
        clear: t('Clear cell formatting', {
          description: 'Loop table cell menu',
        }),
      },
    },
  );

  const width = liveWidth ?? column.width;
  // Its own format, then the header row's (Collaborators: not its column's)
  const look = headerLook(snapshot, column);
  const headerContent = (
    <>
      <Icon iconName={columnTypeIcon[column.type]} $size="16px" />
      <span
        className="loop-table__header-name"
        style={{ textAlign: look.align }}
      >
        {column.name}
      </span>
      {sortedHere && (
        <Icon
          iconName={sortedHere === 'asc' ? 'arrow_upward' : 'arrow_downward'}
          $size="14px"
        />
      )}
    </>
  );

  return (
    <th
      ref={drop.setNodeRef}
      data-column-id={column.id}
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        ...formatStyle(look),
      }}
      className={`${dropSide} ${isDragSource ? 'is-drag-source' : ''}`}
      aria-sort={
        sortedHere === 'asc'
          ? 'ascending'
          : sortedHere === 'desc'
            ? 'descending'
            : undefined
      }
    >
      {isRenaming ? (
        <input
          autoFocus
          className="loop-table__input"
          defaultValue={column.name}
          aria-label={t('Column name', { description: 'Loop table' })}
          onBlur={(event) => {
            updateColumn(table, column.id, {
              name: event.target.value.trim() || column.name,
            });
            setIsRenaming(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setIsRenaming(false);
            }
          }}
        />
      ) : !isEditable ? (
        // Reading: the column's name only, nothing opens a menu
        <div className="loop-table__header is-readonly">{headerContent}</div>
      ) : (
        <div className="loop-table__header-cell">
          <div
            className="loop-table__header"
            role="button"
            tabIndex={0}
            onClick={() => setIsRenaming(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'F2') {
                event.preventDefault();
                setIsRenaming(true);
              }
            }}
            aria-label={t('{{name}} column, {{type}}. Type to rename it', {
              description: 'Accessible name of a Loop table column header',
              name: column.name,
              type: columnTypeLabel(t, column.type),
            })}
          >
            {headerContent}
          </div>
          <DropdownMenu
            options={cellMenu}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <button
              type="button"
              className="loop-table__cell-chevron"
              aria-label={t('Format this cell', {
                description: 'Accessible name of the Loop table cell menu',
              })}
              title={t('Format this cell', {
                description: 'Accessible name of the Loop table cell menu',
              })}
              onClick={(event) => {
                event.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
            >
              <Icon iconName="expand_more" $size="16px" />
            </button>
          </DropdownMenu>
        </div>
      )}

      {isEditable && (
        <div
          className={`loop-table__resize ${liveWidth !== null ? 'is-resizing' : ''}`}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('Resize the {{name}} column', {
            description: 'Accessible name of a column resize handle',
            name: column.name,
          })}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              updateColumn(table, column.id, {
                width: Math.max(
                  80,
                  column.width + (event.key === 'ArrowLeft' ? -20 : 20),
                ),
              });
            }
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            (event.target as HTMLElement).setPointerCapture(event.pointerId);
            startRef.current = { x: event.clientX, width: column.width };
            setLiveWidth(column.width);
          }}
          onPointerMove={(event) => {
            if (startRef.current) {
              setLiveWidth(
                Math.max(
                  80,
                  startRef.current.width + event.clientX - startRef.current.x,
                ),
              );
            }
          }}
          onPointerUp={() => {
            if (startRef.current && liveWidth !== null) {
              updateColumn(table, column.id, { width: Math.round(liveWidth) });
            }
            startRef.current = null;
            setLiveWidth(null);
          }}
        />
      )}
    </th>
  );
};

/**
 * Collaborators: what the handle above a column offers — the whole column
 * (its cells, not its header), and adding, hiding or deleting columns.
 */
export const columnHandleMenuItems = (
  t: TFunction<'translation', undefined>,
  table: Y.Map<unknown>,
  snapshot: TableSnapshot,
  column: Column,
  onNewLabelGroup: () => void,
): DropdownMenuItem[] => {
  const index = snapshot.columns.findIndex((item) => item.id === column.id);
  const sort = snapshot.view.sort;
  const sortedHere = sort?.columnId === column.id ? sort.direction : null;
  const types = Object.values(ColumnType).map((type) => {
    if (type === ColumnType.LABEL) {
      return {
        label: columnTypeLabel(t, type),
        icon: <Icon iconName={columnTypeIcon[type]} $size="18px" />,
        isChecked: column.type === type,
        children: [
          ...allLabelGroups(snapshot).map((group) => ({
            label: group.name,
            isChecked:
              column.type === ColumnType.LABEL &&
              column.labelGroupId === group.id,
            callback: () =>
              changeColumnType(table, column.id, ColumnType.LABEL, group.id),
          })),
          { type: 'separator' as const },
          {
            label: t('New label group…', {
              description: 'Menu entry creating custom labels',
            }),
            icon: <Icon iconName="add" $size="18px" />,
            callback: onNewLabelGroup,
          },
        ],
      };
    }
    return {
      label: columnTypeLabel(t, type),
      icon: <Icon iconName={columnTypeIcon[type]} $size="18px" />,
      isChecked: column.type === type,
      callback: () => {
        if (column.type !== type) {
          changeColumnType(table, column.id, type);
        }
      },
    };
  });
  return [
    // The whole column: its cells, not its header
    ...formatMenuItems(
      t,
      column.format,
      (patch) => setColumnFormat(table, column.id, patch),
      // What it inherits from all the cells, then the defaults
      {
        shown: mergeFormats(snapshot.layout.cells, columnDefaults(column)),
        labels: {
          clear: t('Clear column formatting', {
            description: 'Loop table column menu',
          }),
        },
      },
    ),
    { type: 'separator' },
    {
      label: t('Column type', { description: 'Loop table column menu' }),
      icon: <Icon iconName="category" $size="18px" />,
      children: types,
    },
    {
      label: t('Number format', { description: 'Loop table column menu' }),
      icon: <Icon iconName="tag" $size="18px" />,
      isHidden: column.type !== ColumnType.NUMBER,
      children: Object.values(NumberFormat).map((format) => ({
        label: numberFormatLabel(t, format),
        isChecked: (column.numberFormat ?? NumberFormat.PLAIN) === format,
        callback: () =>
          updateColumn(table, column.id, { numberFormat: format }),
      })),
    },
    { type: 'separator' },
    {
      label: t('Sort ascending', { description: 'Loop table column menu' }),
      icon: <Icon iconName="arrow_upward" $size="18px" />,
      isChecked: sortedHere === 'asc',
      callback: () =>
        setView(table, { sort: { columnId: column.id, direction: 'asc' } }),
    },
    {
      label: t('Sort descending', { description: 'Loop table column menu' }),
      icon: <Icon iconName="arrow_downward" $size="18px" />,
      isChecked: sortedHere === 'desc',
      callback: () =>
        setView(table, { sort: { columnId: column.id, direction: 'desc' } }),
    },
    {
      label: t('Filter by this column', {
        description: 'Loop table column menu',
      }),
      icon: <Icon iconName="filter_list" $size="18px" />,
      callback: () =>
        setView(table, {
          filters: [
            ...snapshot.view.filters,
            {
              id: newId(),
              columnId: column.id,
              operator: operatorsFor(column.type)[0],
              value: '',
            },
          ],
        }),
    },
    { type: 'separator' },
    {
      label: t('Insert column left', { description: 'Loop table column menu' }),
      icon: <Icon iconName="west" $size="18px" />,
      callback: () => addColumn(table, index),
    },
    {
      label: t('Insert column right', {
        description: 'Loop table column menu',
      }),
      icon: <Icon iconName="east" $size="18px" />,
      callback: () => addColumn(table, index + 1),
    },
    {
      label: t('Hide column', { description: 'Loop table column menu' }),
      icon: <Icon iconName="visibility_off" $size="18px" />,
      callback: () => updateColumn(table, column.id, { hidden: true }),
    },
    {
      label: t('Delete column', { description: 'Loop table column menu' }),
      icon: <Icon iconName="delete" $size="18px" />,
      variant: 'danger',
      isHidden: snapshot.columns.length <= 1,
      callback: () => deleteColumn(table, column.id),
    },
  ];
};
