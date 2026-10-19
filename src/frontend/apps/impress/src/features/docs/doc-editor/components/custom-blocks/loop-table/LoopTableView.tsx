import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { fetchAPI } from '@/api';
import { Icon } from '@/components';
import { useAuth } from '@/features/auth';
import { useDocStore } from '@/features/docs/doc-management/stores/useDocStore';

import { Cell, Direction } from './Cell';
import { ColumnHeader } from './ColumnHeader';
import { CornerHeader } from './CornerHeader';
import { SummaryRow } from './SummaryRow';
import { Toolbar } from './Toolbar';
import { formatCell, labelOptionsOf } from './format';
import { formatMenuItems, formatStyle } from './formatMenu';
import {
  CellFormat,
  Column,
  ColumnType,
  Row,
  TableSnapshot,
  addColumn,
  addRow,
  deleteRows,
  duplicateRow,
  mergeFormats,
  moveColumn,
  moveRow,
  setCellFormat,
  setCellValue,
  setRowFormat,
  setTextCell,
} from './model';
import { LoopTableStyle } from './styles';
import { useLoopTable } from './useLoopTable';
import { visibleRows } from './view';

interface LoopTableViewProps {
  ydoc: Y.Doc | null;
  tableId: string;
  isEditable: boolean;
  /** Called when the block points to a table this page does not hold. */
  onRecreate?: () => void;
}

interface ActiveCell {
  rowId: string;
  columnId: string;
}

/** The teams of the current user, for the "Assigned to me" filter. */
const useMyTeams = (enabled: boolean) =>
  useQuery<string[]>({
    queryKey: ['my-teams'],
    queryFn: async () => {
      const response = await fetchAPI('workspaces/my-teams/');
      return response.ok ? ((await response.json()) as string[]) : [];
    },
    enabled,
    staleTime: 60_000,
  });

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };

const RowNumberCell = ({
  row,
  index,
  isEditable,
  canDrag,
  showNumber,
  look,
  menuOptions,
  isMenuOpen,
  onMenuOpenChange,
}: {
  row: Row;
  index: number;
  isEditable: boolean;
  canDrag: boolean;
  showNumber: boolean;
  look: CellFormat;
  menuOptions: DropdownMenuItem[];
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
}) => {
  const { t } = useTranslation();
  const drag = useDraggable({
    id: `row:${row.id}`,
    disabled: !isEditable || !canDrag,
  });
  return (
    <td
      className={`loop-table__rownum ${showNumber ? '' : 'is-numbers-hidden'}`}
      style={formatStyle(look)}
    >
      <div
        className="loop-table__rownum-inner"
        style={look.align ? { justifyContent: JUSTIFY[look.align] } : undefined}
      >
        {showNumber && (
          <span className="loop-table__rownum-number">{index + 1}</span>
        )}
        {isEditable && (
          <>
            <span
              className="loop-table__handle"
              aria-label={t('Move row {{number}}', {
                description: 'Accessible name of a row drag handle',
                number: index + 1,
              })}
              title={
                canDrag
                  ? undefined
                  : t('Remove the sort to reorder rows', {
                      description: 'Tooltip of a disabled row handle',
                    })
              }
              ref={drag.setNodeRef}
              {...drag.listeners}
              {...drag.attributes}
            >
              <Icon iconName="drag_indicator" $size="16px" />
            </span>
            <DropdownMenu
              options={menuOptions}
              isOpen={isMenuOpen}
              onOpenChange={onMenuOpenChange}
            >
              <button
                type="button"
                className={`loop-table__handle ${isMenuOpen ? 'is-open' : ''}`}
                aria-label={t('Row {{number}} actions', {
                  description: 'Accessible name of a row menu button',
                  number: index + 1,
                })}
                onClick={() => onMenuOpenChange(!isMenuOpen)}
              >
                <Icon iconName="more_vert" $size="16px" />
              </button>
            </DropdownMenu>
          </>
        )}
      </div>
    </td>
  );
};

const DroppableRow = ({
  row,
  className,
  children,
}: React.PropsWithChildren<{ row: Row; className: string }>) => {
  const drop = useDroppable({ id: `row:${row.id}` });
  return (
    <tr ref={drop.setNodeRef} className={className} data-row-id={row.id}>
      {children}
    </tr>
  );
};

/** Values pasted from a spreadsheet, converted to the column's type. */
const pastedValue = (
  column: Column,
  text: string,
  snapshot: TableSnapshot,
): number | string | null | undefined => {
  const value = text.trim();
  switch (column.type) {
    case ColumnType.NUMBER: {
      const number = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(number) ? number : null;
    }
    case ColumnType.DATE:
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    case ColumnType.LABEL:
      return (
        labelOptionsOf(column, snapshot).find(
          (option) => option.label.toLowerCase() === value.toLowerCase(),
        )?.id ?? null
      );
    case ColumnType.PERSON:
    case ColumnType.VOTING:
      return undefined;
    default:
      return text;
  }
};

export const LoopTableView = ({
  ydoc,
  tableId,
  isEditable,
  onRecreate,
}: LoopTableViewProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentDoc } = useDocStore();
  const { table, snapshot } = useLoopTable(ydoc, tableId);
  const { data: myTeams } = useMyTeams(!!user);
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  // The cell whose format menu is open, as "rowId:columnId"
  const [cellMenuFor, setCellMenuFor] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Undo and redo inside the table, separate from the page's text history
  const undoManager = useMemo(
    () => (table ? new Y.UndoManager(table, { captureTimeout: 500 }) : null),
    [table],
  );
  useEffect(() => () => undoManager?.destroy(), [undoManager]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(
    () => snapshot?.columns.filter((column) => !column.hidden) ?? [],
    [snapshot],
  );
  const rows = useMemo(
    () =>
      snapshot
        ? visibleRows(snapshot, { userId: user?.id, teams: myTeams })
        : [],
    [snapshot, user?.id, myTeams],
  );

  const move = useCallback(
    (direction: Direction) => {
      if (!active || !table) {
        return;
      }
      const rowIndex = rows.findIndex((row) => row.id === active.rowId);
      const colIndex = columns.findIndex((col) => col.id === active.columnId);
      let r = rowIndex;
      let c = colIndex;
      if (direction === 'up') {
        r = Math.max(0, r - 1);
      } else if (direction === 'down') {
        r = r + 1;
      } else if (direction === 'left') {
        c = Math.max(0, c - 1);
      } else if (direction === 'right') {
        c = Math.min(columns.length - 1, c + 1);
      } else if (direction === 'next') {
        c = c + 1;
        if (c >= columns.length) {
          c = 0;
          r = r + 1;
        }
      } else if (direction === 'prev') {
        c = c - 1;
        if (c < 0) {
          c = columns.length - 1;
          r = Math.max(0, r - 1);
        }
      }
      if (r >= rows.length) {
        // Like Loop: Tab (or Enter) past the last row adds a row
        if (!isEditable || (direction !== 'next' && direction !== 'down')) {
          return;
        }
        const newRowId = addRow(table);
        setActive({ rowId: newRowId, columnId: columns[c].id });
        return;
      }
      setActive({ rowId: rows[r].id, columnId: columns[c].id });
    },
    [active, rows, columns, table, isEditable],
  );

  const hasSnapshot = !!snapshot;
  // A link to one of this table's cells (e.g. from a notification) selects
  // that cell and scrolls it into view
  useEffect(() => {
    const focusCellFromHash = () => {
      const [kind, hashTableId, rowId, columnId] = decodeURIComponent(
        window.location.hash.slice(1),
      ).split(':');
      if (kind !== 'cell' || hashTableId !== tableId || !rowId || !columnId) {
        return;
      }
      setActive({ rowId, columnId });
      setIsEditing(false);
      setTimeout(() => {
        containerRef.current
          ?.querySelector(
            `td[data-row-id="${rowId}"][data-column-id="${columnId}"]`,
          )
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 100);
    };
    focusCellFromHash();
    window.addEventListener('hashchange', focusCellFromHash);
    return () => window.removeEventListener('hashchange', focusCellFromHash);
  }, [tableId, hasSnapshot]);

  // Keep the focus in the grid so keyboard navigation keeps working
  useEffect(() => {
    if (active && !isEditing) {
      containerRef.current?.focus({ preventScroll: true });
    }
  }, [active, isEditing]);

  if (!table || !snapshot) {
    if (tableId && ydoc && onRecreate && isEditable) {
      return (
        <div className="loop-table__missing" contentEditable={false}>
          <LoopTableStyle />
          {t(
            'This table was copied from another page; its content stayed there.',
            { description: 'Shown for a Loop table pasted from another page' },
          )}{' '}
          <button type="button" onClick={onRecreate}>
            {t('Start an empty table here', {
              description: 'Button replacing a missing Loop table',
            })}
          </button>
        </div>
      );
    }
    return (
      <div className="loop-table__missing" contentEditable={false}>
        <LoopTableStyle />
        {t('Loading the table…', { description: 'Loop table loading' })}
      </div>
    );
  }

  const canDragRows = !snapshot.view.sort;
  // Hidden row numbers leave readers without the column; editors keep a
  // narrow one, for the row handles and menu
  const showNumbersColumn = snapshot.layout.showRowNumbers || isEditable;

  const rowMenuOptions = (row: Row): DropdownMenuItem[] => {
    const index = snapshot.rows.findIndex((item) => item.id === row.id);
    return [
      {
        label: t('Insert row above', { description: 'Loop table row menu' }),
        icon: <Icon iconName="north" $size="18px" />,
        callback: () => addRow(table, index),
      },
      {
        label: t('Insert row below', { description: 'Loop table row menu' }),
        icon: <Icon iconName="south" $size="18px" />,
        callback: () => addRow(table, index + 1),
      },
      {
        label: t('Duplicate row', { description: 'Loop table row menu' }),
        icon: <Icon iconName="content_copy" $size="18px" />,
        callback: () => duplicateRow(table, row.id),
      },
      { type: 'separator' },
      // The whole row: its cells and its number
      ...formatMenuItems(t, row.format, (patch) =>
        setRowFormat(table, row.id, patch),
      ),
      { type: 'separator' },
      {
        label: t('Delete row', { description: 'Loop table row menu' }),
        icon: <Icon iconName="delete" $size="18px" />,
        variant: 'danger',
        callback: () => deleteRows(table, [row.id]),
      },
    ];
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // Keep the page editor out of the table's keystrokes
    event.stopPropagation();
    const modifier = event.metaKey || event.ctrlKey;

    if (modifier && event.key.toLowerCase() === 'z' && isEditable) {
      event.preventDefault();
      if (event.shiftKey) {
        undoManager?.redo();
      } else {
        undoManager?.undo();
      }
      return;
    }
    if (modifier && event.key.toLowerCase() === 'y' && isEditable) {
      event.preventDefault();
      undoManager?.redo();
      return;
    }
    if (isEditing || !active) {
      return;
    }
    const keys: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    if (keys[event.key]) {
      event.preventDefault();
      move(keys[event.key]);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      move(event.shiftKey ? 'prev' : 'next');
    } else if ((event.key === 'Enter' || event.key === 'F2') && isEditable) {
      event.preventDefault();
      setIsEditing(true);
    } else if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      isEditable
    ) {
      event.preventDefault();
      const column = columns.find((col) => col.id === active.columnId);
      if (column?.type === ColumnType.TEXT) {
        setTextCell(table, active.rowId, active.columnId, '');
      } else if (column && column.type !== ColumnType.VOTING) {
        setCellValue(
          table,
          active.rowId,
          active.columnId,
          column.type === ColumnType.PERSON ? [] : null,
        );
      }
    } else if (event.key === 'Escape') {
      setActive(null);
    }
  };

  const onPaste = (event: React.ClipboardEvent) => {
    if (isEditing || !active || !isEditable) {
      return;
    }
    const text = event.clipboardData.getData('text/plain');
    if (!text) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const grid = text
      .replace(/\r/g, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((line) => line.split('\t'));
    const startRow = rows.findIndex((row) => row.id === active.rowId);
    const startCol = columns.findIndex((col) => col.id === active.columnId);

    ydoc?.transact(() => {
      // Add the columns and rows the pasted block needs
      const neededCols = startCol + Math.max(...grid.map((r) => r.length));
      for (let i = columns.length; i < neededCols; i++) {
        addColumn(table, snapshot.columns.length + (i - columns.length));
      }
      const rowIds = rows.map((row) => row.id);
      for (let i = rows.length; i < startRow + grid.length; i++) {
        rowIds.push(addRow(table));
      }
      const allColumns = (() => {
        const fresh = table.get('columns') as Y.Array<Y.Map<unknown>>;
        return fresh
          .toArray()
          .map((c) => c.toJSON() as Column)
          .filter((c) => !c.hidden);
      })();
      grid.forEach((cells, r) =>
        cells.forEach((value, c) => {
          const column = allColumns[startCol + c];
          const rowId = rowIds[startRow + r];
          if (!column || !rowId) {
            return;
          }
          if (column.type === ColumnType.TEXT) {
            setTextCell(table, rowId, column.id, value);
            return;
          }
          const converted = pastedValue(column, value, snapshot);
          if (converted !== undefined) {
            setCellValue(table, rowId, column.id, converted);
          }
        }),
      );
    });
  };

  const onDragStart = (event: DragStartEvent) =>
    setDragId(String(event.active.id));
  const onDragOver = (event: DragOverEvent) =>
    setOverId(event.over ? String(event.over.id) : null);
  const onDragEnd = (event: DragEndEvent) => {
    const from = String(event.active.id);
    const to = event.over ? String(event.over.id) : null;
    setDragId(null);
    setOverId(null);
    if (!to || from === to) {
      return;
    }
    const [kind, id] = from.split(':');
    const [toKind, toId] = to.split(':');
    if (kind !== toKind) {
      return;
    }
    if (kind === 'col') {
      const target = snapshot.columns.findIndex((col) => col.id === toId);
      const source = snapshot.columns.findIndex((col) => col.id === id);
      // Dropped on a column: it lands before it
      moveColumn(table, id, source < target ? target - 1 : target);
    } else {
      const target = snapshot.rows.findIndex((row) => row.id === toId);
      const source = snapshot.rows.findIndex((row) => row.id === id);
      moveRow(table, id, source < target ? target - 1 : target);
    }
  };

  const draggedRow =
    dragId?.startsWith('row:') &&
    snapshot.rows.find((row) => `row:${row.id}` === dragId);
  const draggedColumn =
    dragId?.startsWith('col:') &&
    snapshot.columns.find((col) => `col:${col.id}` === dragId);

  return (
    <div
      className="loop-table"
      contentEditable={false}
      data-testid="loop-table"
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onCopy={(event) => event.stopPropagation()}
      onCut={(event) => event.stopPropagation()}
    >
      <LoopTableStyle />
      <Toolbar
        table={table}
        snapshot={snapshot}
        isEditable={isEditable}
        shownRows={rows.length}
      />
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setDragId(null);
          setOverId(null);
        }}
      >
        <div
          ref={containerRef}
          className="loop-table__scroll"
          tabIndex={-1}
          style={{ outline: 'none' }}
        >
          <table
            className="loop-table__grid"
            role="grid"
            aria-rowcount={rows.length + 1}
            aria-label={t('Table', {
              description: 'Name of the editor block type: a Loop-style table',
            })}
          >
            <thead>
              <tr>
                {showNumbersColumn && (
                  <CornerHeader
                    table={table}
                    snapshot={snapshot}
                    isEditable={isEditable}
                  />
                )}
                {columns.map((column) => (
                  <ColumnHeader
                    key={column.id}
                    table={table}
                    snapshot={snapshot}
                    column={column}
                    index={snapshot.columns.findIndex(
                      (c) => c.id === column.id,
                    )}
                    isEditable={isEditable}
                    isDropTarget={
                      overId === `col:${column.id}` &&
                      dragId !== overId &&
                      !!dragId?.startsWith('col:')
                    }
                    isDragSource={dragId === `col:${column.id}`}
                  />
                ))}
                {isEditable && (
                  <th className="loop-table__add-column">
                    <button
                      type="button"
                      aria-label={t('Add a column', {
                        description: 'Loop table add column button',
                      })}
                      title={t('Add a column', {
                        description: 'Loop table add column button',
                      })}
                      onClick={() => addColumn(table, snapshot.columns.length)}
                    >
                      +
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <DroppableRow
                  key={row.id}
                  row={row}
                  className={[
                    dragId === `row:${row.id}` ? 'is-drag-source' : '',
                    overId === `row:${row.id}` &&
                    dragId !== overId &&
                    dragId?.startsWith('row:')
                      ? 'is-drop-before'
                      : '',
                  ].join(' ')}
                >
                  {showNumbersColumn && (
                    <RowNumberCell
                      row={row}
                      index={rowIndex}
                      isEditable={isEditable}
                      canDrag={canDragRows}
                      showNumber={snapshot.layout.showRowNumbers}
                      // The numbers column's own format comes first
                      look={mergeFormats(snapshot.layout.numbers, row.format)}
                      menuOptions={rowMenuOptions(row)}
                      isMenuOpen={rowMenuId === row.id}
                      onMenuOpenChange={(isOpen) =>
                        setRowMenuId(isOpen ? row.id : null)
                      }
                    />
                  )}
                  {columns.map((column) => {
                    const isActive =
                      active?.rowId === row.id &&
                      active?.columnId === column.id;
                    // A cell's own format, then its row's, then its column's
                    const look = mergeFormats(
                      row.cellFormats?.[column.id],
                      row.format,
                      column.format,
                    );
                    return (
                      <td
                        key={column.id}
                        data-row-id={row.id}
                        data-column-id={column.id}
                        data-align={look.align}
                        style={formatStyle(look)}
                        role="gridcell"
                        aria-selected={isActive}
                        onContextMenu={(event) => {
                          if (!isEditable) {
                            return;
                          }
                          event.preventDefault();
                          setActive({ rowId: row.id, columnId: column.id });
                          setIsEditing(false);
                          setCellMenuFor(`${row.id}:${column.id}`);
                        }}
                        className={[
                          isActive ? 'is-active' : '',
                          dragId === `col:${column.id}` ? 'is-drag-source' : '',
                          overId === `col:${column.id}` &&
                          dragId !== overId &&
                          dragId?.startsWith('col:')
                            ? 'is-drop-before'
                            : '',
                        ].join(' ')}
                        onClick={() => {
                          if (isActive && isEditable && !isEditing) {
                            setIsEditing(true);
                          } else if (!isActive) {
                            setActive({ rowId: row.id, columnId: column.id });
                            setIsEditing(false);
                          }
                        }}
                      >
                        <Cell
                          table={table}
                          tableId={tableId}
                          snapshot={snapshot}
                          column={column}
                          rowId={row.id}
                          value={row.cells[column.id]}
                          docId={currentDoc?.id ?? ''}
                          userId={user?.id}
                          isEditable={isEditable}
                          isEditing={isActive && isEditing}
                          onStartEdit={() => {
                            setActive({ rowId: row.id, columnId: column.id });
                            setIsEditing(true);
                          }}
                          onStopEdit={(direction) => {
                            setIsEditing(false);
                            if (direction) {
                              move(direction);
                            }
                          }}
                        />
                        {isActive && isEditable && !isEditing && (
                          <DropdownMenu
                            options={formatMenuItems(
                              t,
                              row.cellFormats?.[column.id],
                              (patch) =>
                                setCellFormat(table, row.id, column.id, patch),
                              {
                                clear: t('Clear cell formatting', {
                                  description: 'Loop table cell menu',
                                }),
                              },
                            )}
                            isOpen={cellMenuFor === `${row.id}:${column.id}`}
                            onOpenChange={(isOpen) =>
                              setCellMenuFor(
                                isOpen ? `${row.id}:${column.id}` : null,
                              )
                            }
                          >
                            <button
                              type="button"
                              className="loop-table__cell-menu"
                              aria-label={t('Format this cell', {
                                description:
                                  'Accessible name of the Loop table cell menu',
                              })}
                              title={t('Format this cell', {
                                description:
                                  'Accessible name of the Loop table cell menu',
                              })}
                              onClick={(event) => {
                                event.stopPropagation();
                                setCellMenuFor(
                                  cellMenuFor === `${row.id}:${column.id}`
                                    ? null
                                    : `${row.id}:${column.id}`,
                                );
                              }}
                            >
                              <Icon iconName="format_color_fill" $size="14px" />
                            </button>
                          </DropdownMenu>
                        )}
                      </td>
                    );
                  })}
                  {isEditable && <td />}
                </DroppableRow>
              ))}
            </tbody>
            <tfoot>
              <SummaryRow
                table={table}
                snapshot={snapshot}
                columns={columns}
                rows={rows}
                isEditable={isEditable}
                withNumbersColumn={showNumbersColumn}
              />
            </tfoot>
          </table>
          {isEditable && (
            <button
              type="button"
              className="loop-table__new-row"
              onClick={() => {
                const rowId = addRow(table);
                if (columns[0]) {
                  setActive({ rowId, columnId: columns[0].id });
                  setIsEditing(true);
                }
              }}
            >
              <Icon iconName="add" $size="18px" />
              {t('New', { description: 'Loop table: adds a row' })}
            </button>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {draggedRow ? (
            <div className="loop-table__drag-preview">
              {columns
                .map((column) =>
                  formatCell(column, draggedRow.cells[column.id], snapshot),
                )
                .filter(Boolean)
                .join(' · ') ||
                t('Empty row', { description: 'Loop table drag preview' })}
            </div>
          ) : draggedColumn ? (
            <div className="loop-table__drag-preview">
              <Icon iconName="view_column" $size="14px" /> {draggedColumn.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
