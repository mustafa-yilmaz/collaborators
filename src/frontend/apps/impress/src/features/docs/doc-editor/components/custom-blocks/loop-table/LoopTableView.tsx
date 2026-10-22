import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { fetchAPI } from '@/api';
import { Icon } from '@/components';
import { useAuth } from '@/features/auth';
import { useDocStore } from '@/features/docs/doc-management/stores/useDocStore';

import { Cell, Direction } from './Cell';
import { ColumnHeader, columnHandleMenuItems } from './ColumnHeader';
import { CornerHeader } from './CornerHeader';
import { ColumnDragPreview, RowDragPreview } from './DragPreview';
import { ColumnControls, HeaderRowControls } from './HandleControls';
import { SummaryRow } from './SummaryRow';
import { Toolbar } from './Toolbar';
import { labelOptionsOf } from './format';
import {
  HEADER_DEFAULTS,
  columnDefaults,
  formatMenuItems,
  formatStyle,
  toggleStyle,
} from './formatMenu';
import {
  CellFormat,
  Column,
  ColumnType,
  Row,
  TableSnapshot,
  TextStyle,
  addColumn,
  addRow,
  cellLook,
  deleteRows,
  duplicateRow,
  mergeFormats,
  moveColumn,
  moveRow,
  setCellFormat,
  setCellValue,
  setLayout,
  setLayoutFormat,
  setRowFormat,
  setTextCell,
} from './model';
import { LoopTableStyle } from './styles';
import { useExpandToMargins } from './useExpandToMargins';
import { useLoopTable } from './useLoopTable';
import { useVisibleRows } from './useVisibleRows';
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

/** A row's number, aligned like the cells of any other column. */
const RowNumberCell = ({
  index,
  look,
}: {
  index: number;
  look: CellFormat;
}) => (
  <td className="loop-table__rownum" style={formatStyle(look)}>
    <div className="loop-table__rownum-number">{index + 1}</div>
  </td>
);

/**
 * The drag handle and the menu of the row under the pointer (or of the
 * selected cell), in the page margin just left of the table, so they need no
 * column of their own and stay there when the numbers are hidden.
 */
const RowControls = ({
  row,
  index,
  canDrag,
  box,
  menuOptions,
  isMenuOpen,
  onMenuOpenChange,
}: {
  row: Row;
  index: number;
  canDrag: boolean;
  box: { top: number; height: number };
  menuOptions: DropdownMenuItem[];
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
}) => {
  const { t } = useTranslation();
  const drag = useDraggable({ id: `row:${row.id}`, disabled: !canDrag });
  return (
    <div className="loop-table__row-controls" style={box}>
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
    </div>
  );
};

/**
 * The row or column a dragged one is over: the one at the pointer's height
 * (rows) or across (columns), so a row handle out in the page margin finds
 * its row; the nearest of the same kind otherwise (keyboard).
 */
const dropTargetUnderPointer: CollisionDetection = (args) => {
  const kind = String(args.active.id).split(':')[0];
  const sameKind = args.droppableContainers.filter((container) =>
    String(container.id).startsWith(`${kind}:`),
  );
  const pointer = args.pointerCoordinates;
  if (pointer) {
    const hit = sameKind.find((container) => {
      const rect = args.droppableRects.get(container.id);
      if (!rect) {
        return false;
      }
      return kind === 'row'
        ? pointer.y >= rect.top && pointer.y <= rect.top + rect.height
        : pointer.x >= rect.left && pointer.x <= rect.left + rect.width;
    });
    if (hit) {
      return [{ id: hit.id }];
    }
  }
  return closestCenter({ ...args, droppableContainers: sameKind });
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
  const [shownWidths, setShownWidths] = useState<Record<string, number>>({});
  const [overId, setOverId] = useState<string | null>(null);
  // The row under the pointer, whose handle and menu show in the margin
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);
  // Collaborators: the header row's and the columns' handles
  const [isOverHeader, setIsOverHeader] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [hoverColumnId, setHoverColumnId] = useState<string | null>(null);
  const [columnMenuId, setColumnMenuId] = useState<string | null>(null);
  const [headerBox, setHeaderBox] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const [columnBox, setColumnBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [controlsBox, setControlsBox] = useState<{
    top: number;
    height: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const expandStyle = useExpandToMargins(
    wrapperRef,
    !!snapshot?.layout.expanded,
  );
  const bodyRef = useRef<HTMLTableSectionElement>(null);

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
  // Very large tables: only the rows on screen are drawn (T56)
  const rowWindow = useVisibleRows(bodyRef, rows.length);
  const revealRow = useRef((_rowId: string) => {});
  revealRow.current = (rowId: string) => {
    const index = rows.findIndex((row) => row.id === rowId);
    if (rowWindow.isVirtual && index >= 0) {
      rowWindow.reveal(index);
    }
  };

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

  // The row whose controls show: the one being moved or whose menu is open,
  // else the one under the pointer, else the one of the selected cell
  const controlsRowId = isEditable
    ? ((dragId?.startsWith('row:') ? dragId.slice(4) : null) ??
      rowMenuId ??
      hoverRowId ??
      active?.rowId ??
      null)
    : null;

  // Line the controls up with their row
  const placeControls = useCallback(() => {
    const wrapper = wrapperRef.current;
    const tr = controlsRowId
      ? wrapper?.querySelector(`tr[data-row-id="${controlsRowId}"]`)
      : null;
    if (!wrapper || !tr) {
      setControlsBox(null);
      return;
    }
    const rowRect = tr.getBoundingClientRect();
    const top = rowRect.top - wrapper.getBoundingClientRect().top;
    setControlsBox((box) =>
      box?.top === top && box.height === rowRect.height
        ? box
        : { top, height: rowRect.height },
    );
  }, [controlsRowId]);
  useLayoutEffect(placeControls, [placeControls, snapshot, rows, columns]);

  // Collaborators: the column whose handle shows (moved, menu open, under
  // the pointer, or of the selected cell), and the header row's
  const controlsColumnId = isEditable
    ? ((dragId?.startsWith('col:') ? dragId.slice(4) : null) ??
      columnMenuId ??
      hoverColumnId ??
      active?.columnId ??
      null)
    : null;
  const showHeaderControls =
    isEditable &&
    !!snapshot?.layout.showHeader &&
    (isOverHeader || headerMenuOpen);

  const placeHandles = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const origin = wrapper.getBoundingClientRect();
    const headerRow = wrapper.querySelector('thead tr');
    if (headerRow) {
      const rect = headerRow.getBoundingClientRect();
      const top = rect.top - origin.top;
      setHeaderBox((box) =>
        box?.top === top && box.height === rect.height
          ? box
          : { top, height: rect.height },
      );
    }
    const th = controlsColumnId
      ? wrapper.querySelector(`th[data-column-id="${controlsColumnId}"]`)
      : null;
    if (!th) {
      setColumnBox(null);
      return;
    }
    const rect = th.getBoundingClientRect();
    const scroll = wrapper.querySelector('.loop-table__scroll');
    const visible = scroll?.getBoundingClientRect();
    // Only the part of the column in view (the table scrolls sideways)
    const left = Math.max(rect.left, visible?.left ?? rect.left);
    const right = Math.min(rect.right, visible?.right ?? rect.right);
    if (right <= left) {
      setColumnBox(null);
      return;
    }
    const next = {
      top: rect.top - origin.top,
      left: left - origin.left,
      width: right - left,
    };
    setColumnBox((box) =>
      box?.top === next.top &&
      box.left === next.left &&
      box.width === next.width
        ? box
        : next,
    );
  }, [controlsColumnId]);
  useLayoutEffect(placeHandles, [placeHandles, snapshot, rows, columns]);
  useEffect(() => {
    const scroll = wrapperRef.current?.querySelector('.loop-table__scroll');
    scroll?.addEventListener('scroll', placeHandles, { passive: true });
    return () => scroll?.removeEventListener('scroll', placeHandles);
  }, [placeHandles]);
  // ...and again when the table moves inside its block, e.g. the toolbar
  // wraps on a narrower page or a row grows with its text
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      placeControls();
      placeHandles();
    });
    observer.observe(wrapper);
    const grid = wrapper.querySelector('.loop-table__grid');
    if (grid) {
      observer.observe(grid);
    }
    return () => observer.disconnect();
  }, [placeControls, placeHandles]);

  // A click anywhere else on the screen lets go of the selected cell (and its
  // blue frame), once the clicked spot has taken the focus, so that a cell
  // being typed in is saved first. The table's own menus and panels, shown
  // above the page, are part of the table.
  useEffect(() => {
    if (!active) {
      return;
    }
    const letGo = () => {
      setActive(null);
      setIsEditing(false);
      setCellMenuFor(null);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        !target ||
        wrapperRef.current?.contains(target) ||
        target.closest(
          '.loop-table__popover, [role="menu"], [role="listbox"], [role="dialog"], .c__dropdown-menu, .bn-menu-dropdown',
        )
      ) {
        return;
      }
      setTimeout(letGo, 0);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    // A click outside the page, in another window, lets go too
    window.addEventListener('blur', letGo);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', letGo);
    };
  }, [active]);

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
      const cellOf = () =>
        containerRef.current?.querySelector(
          `td[data-row-id="${rowId}"][data-column-id="${columnId}"]`,
        );
      setTimeout(() => {
        // In a very large table, the row may not be drawn yet
        if (!cellOf()) {
          revealRow.current(rowId);
        }
        setTimeout(
          () =>
            cellOf()?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
          50,
        );
      }, 100);
    };
    focusCellFromHash();
    window.addEventListener('hashchange', focusCellFromHash);
    return () => window.removeEventListener('hashchange', focusCellFromHash);
  }, [tableId, hasSnapshot]);

  // In a very large table, moving to a row that is not drawn brings it in
  useEffect(() => {
    if (!active || !rowWindow.isVirtual) {
      return;
    }
    const cell = containerRef.current?.querySelector(
      `td[data-row-id="${active.rowId}"][data-column-id="${active.columnId}"]`,
    );
    if (cell) {
      cell.scrollIntoView({ block: 'nearest' });
    } else {
      revealRow.current(active.rowId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.rowId, active?.columnId]);

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
  const showNumbersColumn = snapshot.layout.showRowNumbers;
  const controlsRowIndex = rows.findIndex((row) => row.id === controlsRowId);
  const controlsRow = rows[controlsRowIndex];

  const controlsColumn = columns.find((col) => col.id === controlsColumnId);
  // Collaborators: the header row as a whole, from its handle
  const headerRowMenuOptions: DropdownMenuItem[] = [
    {
      label: t('Format the whole header row', {
        description: 'Loop table header row menu',
      }),
      icon: <Icon iconName="format_color_fill" $size="18px" />,
      children: formatMenuItems(
        t,
        snapshot.layout.header,
        (patch) => setLayoutFormat(table, 'header', patch),
        { shown: HEADER_DEFAULTS },
      ),
    },
    { type: 'separator' },
    {
      label: t('Hide the header row', {
        description: 'Loop table header row menu',
      }),
      icon: <Icon iconName="visibility_off" $size="18px" />,
      callback: () => {
        setHeaderMenuOpen(false);
        setLayout(table, { showHeader: false });
      },
    },
  ];

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
      ...formatMenuItems(
        t,
        row.format,
        (patch) => setRowFormat(table, row.id, patch),
        { shown: snapshot.layout.cells },
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
    // ⌘/Ctrl + B, I, U style the whole selected cell, as in a spreadsheet
    const styleKeys: Record<string, TextStyle> = {
      b: 'bold',
      i: 'italic',
      u: 'underline',
    };
    const style = modifier ? styleKeys[event.key.toLowerCase()] : undefined;
    if (style && isEditable) {
      event.preventDefault();
      const row = snapshot.rows.find((item) => item.id === active.rowId);
      const column = columns.find((col) => col.id === active.columnId);
      if (row && column) {
        const inherited = mergeFormats(
          row.format,
          column.format,
          snapshot.layout.cells,
        );
        setCellFormat(
          table,
          row.id,
          column.id,
          toggleStyle(style, cellLook(snapshot, row, column), inherited),
        );
      }
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

  /**
   * Where a dragged row or column would land, shown by a line: after the
   * one under it when moving down or right, before it when moving up or
   * left.
   */
  const dropSide = (kind: 'row' | 'col', id: string) => {
    if (!dragId?.startsWith(`${kind}:`) || overId !== `${kind}:${id}`) {
      return '';
    }
    const items = kind === 'row' ? snapshot.rows : snapshot.columns;
    const source = items.findIndex((item) => `${kind}:${item.id}` === dragId);
    const target = items.findIndex((item) => item.id === id);
    if (source === target) {
      return '';
    }
    return source < target ? 'is-drop-after' : 'is-drop-before';
  };

  const onDragStart = (event: DragStartEvent) => {
    // The columns' widths as shown (the table stretches them to fill the
    // page), for the preview of what is dragged
    const widths: Record<string, number> = {};
    wrapperRef.current
      ?.querySelectorAll<HTMLElement>('tbody tr:first-child td[data-column-id]')
      .forEach((cell) => {
        widths[cell.dataset.columnId ?? ''] =
          cell.getBoundingClientRect().width;
      });
    setShownWidths(widths);
    setDragId(String(event.active.id));
  };
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
    // It takes the place of the one it was dropped on: after it when moved
    // down or right, before it when moved up or left
    if (kind === 'col') {
      moveColumn(
        table,
        id,
        snapshot.columns.findIndex((col) => col.id === toId),
      );
    } else {
      moveRow(
        table,
        id,
        snapshot.rows.findIndex((row) => row.id === toId),
      );
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
      ref={wrapperRef}
      className={`loop-table ${expandStyle ? 'is-expanded' : ''} ${
        isEditable ? 'is-editable' : ''
      }`}
      style={expandStyle ?? undefined}
      contentEditable={false}
      data-testid="loop-table"
      onMouseOver={(event) => {
        const target = event.target as HTMLElement;
        // Collaborators: the column and the header row under the pointer
        const cell = target.closest('[data-column-id]');
        if (cell) {
          setHoverColumnId(cell.getAttribute('data-column-id'));
        }
        if (target.closest('thead')) {
          setIsOverHeader(true);
        } else if (target.closest('tbody, tfoot')) {
          setIsOverHeader(false);
        }
        const tr = target.closest('tr[data-row-id]');
        if (tr) {
          setHoverRowId(tr.getAttribute('data-row-id'));
        } else if (target.closest('thead, tfoot, .loop-table__toolbar')) {
          setHoverRowId(null);
        }
      }}
      onMouseLeave={() => {
        setHoverRowId(null);
        setHoverColumnId(null);
        setIsOverHeader(false);
      }}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onCopy={(event) => event.stopPropagation()}
      onCut={(event) => event.stopPropagation()}
    >
      <LoopTableStyle />
      <Toolbar
        table={table}
        tableId={tableId}
        snapshot={snapshot}
        isEditable={isEditable}
        shownRows={rows.length}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={dropTargetUnderPointer}
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
            <thead
              className={
                snapshot.layout.showHeader ? undefined : 'is-hidden-header'
              }
            >
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
                    isEditable={isEditable}
                    dropSide={dropSide('col', column.id)}
                    isDragSource={dragId === `col:${column.id}`}
                  />
                ))}
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {rowWindow.above > 0 && (
                <tr
                  aria-hidden="true"
                  className="loop-table__spacer"
                  style={{ height: rowWindow.above }}
                >
                  <td colSpan={columns.length + (showNumbersColumn ? 1 : 0)} />
                </tr>
              )}
              {rows.slice(rowWindow.start, rowWindow.end).map((row, offset) => {
                const rowIndex = rowWindow.start + offset;
                return (
                  <DroppableRow
                    key={row.id}
                    row={row}
                    className={[
                      dragId === `row:${row.id}` ? 'is-drag-source' : '',
                      dropSide('row', row.id),
                    ].join(' ')}
                  >
                    {showNumbersColumn && (
                      <RowNumberCell
                        index={rowIndex}
                        // The numbers column's own format comes first
                        look={mergeFormats(snapshot.layout.numbers, row.format)}
                      />
                    )}
                    {columns.map((column) => {
                      const isActive =
                        active?.rowId === row.id &&
                        active?.columnId === column.id;
                      // A cell's own format, then its row's, its column's,
                      // and the one of all the cells
                      const look = cellLook(snapshot, row, column);
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
                            dragId === `col:${column.id}`
                              ? 'is-drag-source'
                              : '',
                            dropSide('col', column.id),
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
                            rich={row.rich?.[column.id]}
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
                          {/* Collaborators: also while typing in the cell
                              (right-click opens it too) */}
                          {isActive && isEditable && (
                            <DropdownMenu
                              options={formatMenuItems(
                                t,
                                row.cellFormats?.[column.id],
                                (patch) =>
                                  setCellFormat(
                                    table,
                                    row.id,
                                    column.id,
                                    patch,
                                  ),
                                {
                                  // What the cell inherits from its row and
                                  // column, then the defaults
                                  shown: mergeFormats(
                                    row.format,
                                    column.format,
                                    snapshot.layout.cells,
                                    columnDefaults(column),
                                  ),
                                  labels: {
                                    clear: t('Clear cell formatting', {
                                      description: 'Loop table cell menu',
                                    }),
                                  },
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
                                <Icon
                                  iconName="format_color_fill"
                                  $size="16px"
                                />
                              </button>
                            </DropdownMenu>
                          )}
                        </td>
                      );
                    })}
                  </DroppableRow>
                );
              })}
              {rowWindow.below > 0 && (
                <tr
                  aria-hidden="true"
                  className="loop-table__spacer"
                  style={{ height: rowWindow.below }}
                >
                  <td colSpan={columns.length + (showNumbersColumn ? 1 : 0)} />
                </tr>
              )}
            </tbody>
            {snapshot.layout.showSummary && (
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
            )}
          </table>
        </div>
        {controlsRow && controlsBox && (
          <RowControls
            key={controlsRow.id}
            row={controlsRow}
            index={controlsRowIndex}
            canDrag={canDragRows}
            box={controlsBox}
            menuOptions={rowMenuOptions(controlsRow)}
            isMenuOpen={rowMenuId === controlsRow.id}
            onMenuOpenChange={(isOpen) =>
              setRowMenuId(isOpen ? controlsRow.id : null)
            }
          />
        )}
        {showHeaderControls && headerBox && (
          <HeaderRowControls
            box={headerBox}
            menuOptions={headerRowMenuOptions}
            isMenuOpen={headerMenuOpen}
            onMenuOpenChange={setHeaderMenuOpen}
          />
        )}
        {controlsColumn && columnBox && (
          <ColumnControls
            key={controlsColumn.id}
            column={controlsColumn}
            canDrag={isEditable}
            box={columnBox}
            menuOptions={columnHandleMenuItems(
              t,
              table,
              snapshot,
              controlsColumn,
            )}
            isMenuOpen={columnMenuId === controlsColumn.id}
            onMenuOpenChange={(isOpen) =>
              setColumnMenuId(isOpen ? controlsColumn.id : null)
            }
          />
        )}
        <DragOverlay dropAnimation={null}>
          {/* What is being moved, as it looks in the table */}
          {draggedRow ? (
            <RowDragPreview
              row={draggedRow}
              columns={columns}
              snapshot={snapshot}
              widths={shownWidths}
            />
          ) : draggedColumn ? (
            <ColumnDragPreview
              column={draggedColumn}
              rows={rows}
              snapshot={snapshot}
              widths={shownWidths}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
