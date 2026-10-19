/**
 * Data model of the Loop-style table.
 *
 * The table block in the editor only stores a `tableId`. The table itself
 * lives in the same Y.Doc as the page, under `ydoc.getMap(LOOP_TABLES_KEY)`,
 * so it is synced, persisted and versioned with the page, while each cell is
 * its own Yjs value: two people editing different cells, or the same text
 * cell, never overwrite each other.
 *
 *   loop-tables: Y.Map<tableId, Y.Map>
 *     columns: Y.Array<Y.Map>   id, name, type, width, options...
 *     rows:    Y.Array<Y.Map>   id, cells: Y.Map<columnId, value>
 *     labelGroups: Y.Map<groupId, Y.Map>   name, options (JSON)
 *     view:    Y.Map            sort, filters, summaries (JSON)
 *     layout:  Y.Map            showRowNumbers, header, numbers (formats)
 *
 * Formats (background colour, horizontal and vertical alignment) are kept
 * on a column (`format`), a row (`format`), a cell (the row's `cellFormats`
 * Y.Map, by column id, so people formatting different cells don't clash),
 * and in `layout` for the header row and the numbers column.
 *
 * Cell values by column type:
 *   text    Y.Text
 *   number  number | null
 *   date    'YYYY-MM-DD' | null
 *   person  PersonValue[] (people and groups)
 *   label   option id | null
 *   voting  Y.Map<userId, true>
 */
import * as Y from 'yjs';

import { RichRun, readRichCell, writeRuns } from './richText';

export const LOOP_TABLES_KEY = 'loop-tables';

export enum ColumnType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  PERSON = 'person',
  LABEL = 'label',
  VOTING = 'voting',
}

export enum NumberFormat {
  PLAIN = 'plain',
  DECIMAL = 'decimal',
  PERCENT = 'percent',
  CURRENCY = 'currency',
}

export enum SummaryKind {
  NONE = 'none',
  SUM = 'sum',
  AVERAGE = 'average',
  COUNT = 'count',
  MIN = 'min',
  MAX = 'max',
}

export interface PersonValue {
  kind: 'user' | 'group';
  /** A user id, or a team string for groups (e.g. "group:<uuid>"). */
  id: string;
  label: string;
}

export interface LabelOption {
  id: string;
  label: string;
  color: string;
}

export interface LabelGroup {
  id: string;
  name: string;
  options: LabelOption[];
}

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/** How a column, a row, a cell, the header row or the numbers column look. */
export interface CellFormat {
  background?: string;
  align?: HorizontalAlign;
  valign?: VerticalAlign;
}

/** A change of format: a value sets it, null takes it away. */
export type FormatPatch = {
  [Key in keyof CellFormat]?: CellFormat[Key] | null;
};

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  width: number;
  numberFormat?: NumberFormat;
  currency?: string;
  labelGroupId?: string;
  hidden?: boolean;
  format?: CellFormat;
}

export type FilterOperator =
  | 'contains'
  | 'not_contains'
  | 'is'
  | 'is_not'
  | 'empty'
  | 'not_empty'
  | 'gt'
  | 'lt'
  | 'before'
  | 'after'
  | 'includes_me';

export interface FilterRule {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value?: string;
}

export interface SortRule {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface ViewState {
  sort: SortRule | null;
  filters: FilterRule[];
  summaries: Record<string, SummaryKind>;
}

export type CellValue =
  string | number | null | PersonValue[] | string[]; /* voters */

export interface Row {
  id: string;
  /** Plain snapshot of every cell, for display, sorting and filtering. */
  cells: Record<string, CellValue>;
  format?: CellFormat;
  /** Formats of single cells, by column id */
  cellFormats?: Record<string, CellFormat>;
  /** Text cells with formatting (bold, colours, links…), by column id */
  rich?: Record<string, RichRun[]>;
}

/** The header row and the numbers column (the row numbers on the left). */
export interface TableLayout {
  showRowNumbers: boolean;
  header: CellFormat;
  numbers: CellFormat;
}

export interface TableSnapshot {
  columns: Column[];
  rows: Row[];
  labelGroups: LabelGroup[];
  view: ViewState;
  layout: TableLayout;
}

export const DEFAULT_COLUMN_WIDTH = 180;

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// -- Built-in label groups (Loop has "Priority" and "Progress")

export const BUILTIN_LABEL_GROUPS: LabelGroup[] = [
  {
    id: 'priority',
    name: 'Priority',
    options: [
      { id: 'low', label: 'Low', color: 'green' },
      { id: 'medium', label: 'Medium', color: 'yellow' },
      { id: 'high', label: 'High', color: 'red' },
    ],
  },
  {
    id: 'progress',
    name: 'Progress',
    options: [
      { id: 'not-started', label: 'Not started', color: 'gray' },
      { id: 'in-progress', label: 'In progress', color: 'blue' },
      { id: 'done', label: 'Done', color: 'green' },
    ],
  },
];

// -- Access

export const getTablesMap = (ydoc: Y.Doc) =>
  ydoc.getMap<Y.Map<unknown>>(LOOP_TABLES_KEY);

export const getTable = (ydoc: Y.Doc, tableId: string) =>
  getTablesMap(ydoc).get(tableId);

const getColumnsArray = (table: Y.Map<unknown>) =>
  table.get('columns') as Y.Array<Y.Map<unknown>>;
const getRowsArray = (table: Y.Map<unknown>) =>
  table.get('rows') as Y.Array<Y.Map<unknown>>;
const getView = (table: Y.Map<unknown>) => table.get('view') as Y.Map<unknown>;
const getLabelGroups = (table: Y.Map<unknown>) =>
  table.get('labelGroups') as Y.Map<Y.Map<unknown>>;
/** The layout map, created on the first change (older tables have none). */
const getLayout = (table: Y.Map<unknown>, create = false) => {
  let layout = table.get('layout') as Y.Map<unknown> | undefined;
  if (!layout && create) {
    layout = new Y.Map<unknown>();
    table.set('layout', layout);
  }
  return layout;
};

const emptyValueFor = (type: ColumnType): unknown => {
  switch (type) {
    case ColumnType.TEXT:
      return new Y.Text();
    case ColumnType.VOTING:
      return new Y.Map<boolean>();
    case ColumnType.PERSON:
      return [];
    default:
      return null;
  }
};

const columnToYMap = (column: Column) => {
  const ycolumn = new Y.Map<unknown>();
  Object.entries(column).forEach(([key, value]) => {
    if (value !== undefined) {
      ycolumn.set(key, value);
    }
  });
  return ycolumn;
};

/**
 * A new row, with the given values. Values are put in the cells before the
 * row joins the document: Yjs can't read back a map that isn't attached yet.
 */
const newRowYMap = (
  columns: Column[],
  values: Record<string, CellValue> = {},
) => {
  const row = new Y.Map<unknown>();
  row.set('id', newId());
  const cells = new Y.Map<unknown>();
  columns.forEach((column) => {
    const value = values[column.id];
    cells.set(
      column.id,
      value === undefined || value === null
        ? emptyValueFor(column.type)
        : toYValue(column.type, value),
    );
  });
  row.set('cells', cells);
  return row;
};

/** Create a table, 2 text columns by 2 rows like Loop, and return its id. */
export const createTable = (
  ydoc: Y.Doc,
  init?: { columns?: Column[]; rows?: Record<string, CellValue>[] },
): string => {
  const tableId = newId();
  ydoc.transact(() => {
    const table = new Y.Map<unknown>();
    const columns = init?.columns ?? [
      {
        id: newId(),
        name: 'Column 1',
        type: ColumnType.TEXT,
        width: DEFAULT_COLUMN_WIDTH,
      },
      {
        id: newId(),
        name: 'Column 2',
        type: ColumnType.TEXT,
        width: DEFAULT_COLUMN_WIDTH,
      },
    ];
    const ycolumns = new Y.Array<Y.Map<unknown>>();
    ycolumns.push(columns.map(columnToYMap));
    table.set('columns', ycolumns);

    const yrows = new Y.Array<Y.Map<unknown>>();
    const rowValues = init?.rows ?? [{}, {}];
    yrows.push(rowValues.map((values) => newRowYMap(columns, values)));
    table.set('rows', yrows);
    table.set('labelGroups', new Y.Map());
    const view = new Y.Map<unknown>();
    view.set('sort', null);
    view.set('filters', []);
    view.set('summaries', {});
    table.set('view', view);
    getTablesMap(ydoc).set(tableId, table);
  });
  return tableId;
};

/** Convert a plain value to what the column type stores in Yjs. */
const toYValue = (type: ColumnType, value: CellValue): unknown => {
  if (type === ColumnType.TEXT) {
    return new Y.Text(value === null ? '' : String(value));
  }
  if (type === ColumnType.VOTING) {
    const voters = new Y.Map<boolean>();
    (Array.isArray(value) ? (value as string[]) : []).forEach((id) =>
      voters.set(id, true),
    );
    return voters;
  }
  return value;
};

/** Copy a table (e.g. after a block was duplicated or pasted) under a new id. */
export const cloneTable = (ydoc: Y.Doc, snapshot: TableSnapshot): string => {
  const tableId = createTable(ydoc, {
    columns: snapshot.columns,
    rows: snapshot.rows.map((row) => row.cells),
  });
  const table = getTable(ydoc, tableId);
  if (table) {
    ydoc.transact(() => {
      snapshot.labelGroups.forEach((group) => upsertLabelGroup(table, group));
      const view = getView(table);
      view.set('sort', snapshot.view.sort);
      view.set('filters', snapshot.view.filters);
      view.set('summaries', snapshot.view.summaries);
      getRowsArray(table)
        .toArray()
        .forEach((yrow, index) => {
          const row = snapshot.rows[index];
          // The formatting of text cells comes along
          Object.entries(row?.rich ?? {}).forEach(([columnId, runs]) => {
            const text = (yrow.get('cells') as Y.Map<unknown>).get(columnId);
            if (text instanceof Y.Text) {
              writeRuns(text, runs);
            }
          });
          if (row?.format) {
            yrow.set('format', row.format);
          }
          if (row?.cellFormats && Object.keys(row.cellFormats).length) {
            const formats = new Y.Map<unknown>();
            yrow.set('cellFormats', formats);
            Object.entries(row.cellFormats).forEach(([columnId, format]) =>
              formats.set(columnId, format),
            );
          }
        });
      setLayout(table, snapshot.layout);
    });
  }
  return tableId;
};

// -- Reading

const readCell = (column: Column, value: unknown): CellValue => {
  if (value instanceof Y.Text) {
    return value.toString();
  }
  if (value instanceof Y.Map) {
    return Array.from(value.keys()).sort();
  }
  if (value === undefined) {
    return column.type === ColumnType.PERSON ||
      column.type === ColumnType.VOTING
      ? []
      : null;
  }
  return value as CellValue;
};

export const readTable = (table: Y.Map<unknown>): TableSnapshot => {
  const columns = getColumnsArray(table)
    .toArray()
    .map((ycolumn) => ycolumn.toJSON() as Column);
  const rows = getRowsArray(table)
    .toArray()
    .map((yrow) => {
      const cells = yrow.get('cells') as Y.Map<unknown>;
      const cellFormats = yrow.get('cellFormats') as Y.Map<unknown> | undefined;
      const rich: Record<string, RichRun[]> = {};
      columns.forEach((column) => {
        const value = cells.get(column.id);
        const runs = value instanceof Y.Text ? readRichCell(value) : undefined;
        if (runs) {
          rich[column.id] = runs;
        }
      });
      return {
        id: yrow.get('id') as string,
        cells: Object.fromEntries(
          columns.map((column) => [
            column.id,
            readCell(column, cells.get(column.id)),
          ]),
        ),
        format: yrow.get('format') as CellFormat | undefined,
        cellFormats: cellFormats?.toJSON(),
        ...(Object.keys(rich).length ? { rich } : {}),
      };
    });
  const labelGroups = Array.from(getLabelGroups(table).entries()).map(
    ([id, ygroup]) => ({
      id,
      name: ygroup.get('name') as string,
      options: (ygroup.get('options') as LabelOption[]) ?? [],
    }),
  );
  const view = getView(table);
  const layout = getLayout(table);
  return {
    columns,
    rows,
    labelGroups,
    view: {
      sort: (view.get('sort') as SortRule | null) ?? null,
      filters: (view.get('filters') as FilterRule[]) ?? [],
      summaries: (view.get('summaries') as Record<string, SummaryKind>) ?? {},
    },
    layout: {
      showRowNumbers: layout?.get('showRowNumbers') !== false,
      header: (layout?.get('header') as CellFormat) ?? {},
      numbers: (layout?.get('numbers') as CellFormat) ?? {},
    },
  };
};

// -- Writing: columns

const findIndex = (array: Y.Array<Y.Map<unknown>>, id: string) =>
  array.toArray().findIndex((item) => item.get('id') === id);

export const addColumn = (
  table: Y.Map<unknown>,
  index: number,
  partial?: Partial<Column>,
) => {
  const doc = table.doc;
  const column: Column = {
    id: newId(),
    name: partial?.name ?? 'Column',
    type: partial?.type ?? ColumnType.TEXT,
    width: partial?.width ?? DEFAULT_COLUMN_WIDTH,
    ...partial,
  };
  const transact = () => {
    getColumnsArray(table).insert(index, [columnToYMap(column)]);
    getRowsArray(table).forEach((row) =>
      (row.get('cells') as Y.Map<unknown>).set(
        column.id,
        emptyValueFor(column.type),
      ),
    );
  };
  if (doc) {
    doc.transact(transact);
  } else {
    transact();
  }
  return column.id;
};

export const updateColumn = (
  table: Y.Map<unknown>,
  columnId: string,
  changes: Partial<Omit<Column, 'id' | 'type'>>,
) => {
  const columns = getColumnsArray(table);
  const ycolumn = columns.get(findIndex(columns, columnId));
  if (!ycolumn) {
    return;
  }
  table.doc?.transact(() => {
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined) {
        ycolumn.delete(key);
      } else {
        ycolumn.set(key, value);
      }
    });
  });
};

/**
 * Change the type of a column, converting the values that make sense in
 * the new type (Loop erases them all; we keep what we can).
 */
export const changeColumnType = (
  table: Y.Map<unknown>,
  columnId: string,
  type: ColumnType,
  labelGroupId?: string,
) => {
  const columns = getColumnsArray(table);
  const ycolumn = columns.get(findIndex(columns, columnId));
  if (!ycolumn) {
    return;
  }
  const snapshot = readTable(table);
  const previous = snapshot.columns.find((column) => column.id === columnId);
  const labelOptions =
    allLabelGroups(snapshot).find((group) => group.id === labelGroupId)
      ?.options ?? [];

  table.doc?.transact(() => {
    ycolumn.set('type', type);
    if (labelGroupId) {
      ycolumn.set('labelGroupId', labelGroupId);
    }
    getRowsArray(table).forEach((yrow, index) => {
      const cells = yrow.get('cells') as Y.Map<unknown>;
      const before = snapshot.rows[index]?.cells[columnId] ?? null;
      cells.set(
        columnId,
        convertValue(
          before,
          previous?.type ?? ColumnType.TEXT,
          type,
          labelOptions,
        ),
      );
    });
  });
};

const convertValue = (
  value: CellValue,
  from: ColumnType,
  to: ColumnType,
  labelOptions: LabelOption[],
): unknown => {
  const asText =
    value === null
      ? ''
      : Array.isArray(value)
        ? from === ColumnType.PERSON
          ? (value as PersonValue[]).map((person) => person.label).join(', ')
          : String(value.length)
        : String(value);

  switch (to) {
    case ColumnType.TEXT:
      return new Y.Text(asText);
    case ColumnType.NUMBER: {
      const number = parseFloat(asText.replace(',', '.'));
      return Number.isFinite(number) ? number : null;
    }
    case ColumnType.DATE:
      return /^\d{4}-\d{2}-\d{2}$/.test(asText) ? asText : null;
    case ColumnType.LABEL:
      return (
        labelOptions.find(
          (option) =>
            option.id === asText ||
            option.label.toLowerCase() === asText.toLowerCase(),
        )?.id ?? null
      );
    case ColumnType.PERSON:
      return from === ColumnType.PERSON ? value : [];
    case ColumnType.VOTING:
      return new Y.Map<boolean>();
  }
};

export const deleteColumn = (table: Y.Map<unknown>, columnId: string) => {
  table.doc?.transact(() => {
    const columns = getColumnsArray(table);
    const index = findIndex(columns, columnId);
    if (index >= 0) {
      columns.delete(index, 1);
    }
    getRowsArray(table).forEach((row) =>
      (row.get('cells') as Y.Map<unknown>).delete(columnId),
    );
    const view = getView(table);
    const sort = view.get('sort') as SortRule | null;
    if (sort?.columnId === columnId) {
      view.set('sort', null);
    }
    view.set(
      'filters',
      ((view.get('filters') as FilterRule[]) ?? []).filter(
        (rule) => rule.columnId !== columnId,
      ),
    );
  });
};

/** Move an item of a Y.Array: Yjs has no move, so delete and re-insert a copy. */
const moveItem = (
  array: Y.Array<Y.Map<unknown>>,
  from: number,
  to: number,
  clone: (item: Y.Map<unknown>) => Y.Map<unknown>,
) => {
  if (from === to || from < 0 || to < 0 || from >= array.length) {
    return;
  }
  const copy = clone(array.get(from));
  array.delete(from, 1);
  array.insert(Math.min(to, array.length), [copy]);
};

const cloneYValue = (value: unknown): unknown => {
  if (value instanceof Y.Text) {
    const text = new Y.Text();
    text.applyDelta(value.toDelta() as Parameters<Y.Text['applyDelta']>[0]);
    return text;
  }
  if (value instanceof Y.Map) {
    const map = new Y.Map<unknown>();
    value.forEach((item, key) => map.set(key, cloneYValue(item)));
    return map;
  }
  if (value instanceof Y.Array) {
    const array = new Y.Array<unknown>();
    array.push(value.toArray().map(cloneYValue));
    return array;
  }
  return value;
};

const cloneYMap = (map: Y.Map<unknown>) => cloneYValue(map) as Y.Map<unknown>;

export const moveColumn = (
  table: Y.Map<unknown>,
  columnId: string,
  toIndex: number,
) => {
  table.doc?.transact(() => {
    const columns = getColumnsArray(table);
    moveItem(columns, findIndex(columns, columnId), toIndex, cloneYMap);
  });
};

// -- Writing: rows

export const addRow = (table: Y.Map<unknown>, index?: number) => {
  const columns = readTable(table).columns;
  const row = newRowYMap(columns);
  table.doc?.transact(() => {
    const rows = getRowsArray(table);
    rows.insert(index ?? rows.length, [row]);
  });
  return row.get('id') as string;
};

export const duplicateRow = (table: Y.Map<unknown>, rowId: string) => {
  table.doc?.transact(() => {
    const rows = getRowsArray(table);
    const index = findIndex(rows, rowId);
    if (index < 0) {
      return;
    }
    const copy = cloneYMap(rows.get(index));
    copy.set('id', newId());
    rows.insert(index + 1, [copy]);
  });
};

export const deleteRows = (table: Y.Map<unknown>, rowIds: string[]) => {
  table.doc?.transact(() => {
    const rows = getRowsArray(table);
    rowIds.forEach((rowId) => {
      const index = findIndex(rows, rowId);
      if (index >= 0) {
        rows.delete(index, 1);
      }
    });
  });
};

export const moveRow = (
  table: Y.Map<unknown>,
  rowId: string,
  toIndex: number,
) => {
  table.doc?.transact(() => {
    const rows = getRowsArray(table);
    moveItem(rows, findIndex(rows, rowId), toIndex, cloneYMap);
  });
};

// -- Writing: cells

const getCells = (table: Y.Map<unknown>, rowId: string) => {
  const rows = getRowsArray(table);
  return rows.get(findIndex(rows, rowId))?.get('cells') as
    Y.Map<unknown> | undefined;
};

/** The Y.Text of a text cell, created if missing, for collaborative editing. */
export const getTextCell = (
  table: Y.Map<unknown>,
  rowId: string,
  columnId: string,
): Y.Text | undefined => {
  const cells = getCells(table, rowId);
  if (!cells) {
    return undefined;
  }
  const value = cells.get(columnId);
  if (value instanceof Y.Text) {
    return value;
  }
  const text = new Y.Text(
    value === null || value === undefined ? '' : String(value),
  );
  cells.set(columnId, text);
  return text;
};

/** Replace the whole text of a text cell with the fewest changes. */
export const setTextCell = (
  table: Y.Map<unknown>,
  rowId: string,
  columnId: string,
  next: string,
) => {
  table.doc?.transact(() => {
    const text = getTextCell(table, rowId, columnId);
    if (!text) {
      return;
    }
    const current = text.toString();
    if (current === next) {
      return;
    }
    let start = 0;
    while (
      start < current.length &&
      start < next.length &&
      current[start] === next[start]
    ) {
      start++;
    }
    let endCurrent = current.length;
    let endNext = next.length;
    while (
      endCurrent > start &&
      endNext > start &&
      current[endCurrent - 1] === next[endNext - 1]
    ) {
      endCurrent--;
      endNext--;
    }
    if (endCurrent > start) {
      text.delete(start, endCurrent - start);
    }
    if (endNext > start) {
      text.insert(start, next.slice(start, endNext));
    }
  });
};

export const setCellValue = (
  table: Y.Map<unknown>,
  rowId: string,
  columnId: string,
  value: number | string | null | PersonValue[],
) => {
  table.doc?.transact(() => {
    getCells(table, rowId)?.set(columnId, value);
  });
};

export const toggleVote = (
  table: Y.Map<unknown>,
  rowId: string,
  columnId: string,
  userId: string,
) => {
  table.doc?.transact(() => {
    const cells = getCells(table, rowId);
    if (!cells) {
      return;
    }
    let voters = cells.get(columnId);
    if (!(voters instanceof Y.Map)) {
      voters = new Y.Map<boolean>();
      cells.set(columnId, voters);
    }
    const map = voters as Y.Map<boolean>;
    if (map.has(userId)) {
      map.delete(userId);
    } else {
      map.set(userId, true);
    }
  });
};

// -- Label groups

export const allLabelGroups = (snapshot: TableSnapshot): LabelGroup[] => [
  ...BUILTIN_LABEL_GROUPS,
  ...snapshot.labelGroups,
];

export const upsertLabelGroup = (table: Y.Map<unknown>, group: LabelGroup) => {
  const groups = getLabelGroups(table);
  let ygroup = groups.get(group.id);
  if (!ygroup) {
    ygroup = new Y.Map<unknown>();
    groups.set(group.id, ygroup);
  }
  ygroup.set('name', group.name);
  ygroup.set('options', group.options);
};

// -- View

export const setView = (table: Y.Map<unknown>, changes: Partial<ViewState>) => {
  table.doc?.transact(() => {
    const view = getView(table);
    Object.entries(changes).forEach(([key, value]) => view.set(key, value));
  });
};

// -- Formats

/** The format with the patch applied, or undefined when nothing is left. */
export const applyFormatPatch = (
  format: CellFormat | undefined,
  patch: FormatPatch,
): CellFormat | undefined => {
  const next: Record<string, unknown> = { ...format };
  Object.entries(patch).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  });
  return Object.keys(next).length ? next : undefined;
};

/** Take away every format property. */
export const CLEAR_FORMAT: FormatPatch = {
  background: null,
  align: null,
  valign: null,
};

/**
 * The format shown, from the most specific to the least: each property
 * comes from the first format that sets it.
 */
export const mergeFormats = (
  ...formats: (CellFormat | undefined)[]
): CellFormat => ({
  background: formats.find((format) => format?.background)?.background,
  align: formats.find((format) => format?.align)?.align,
  valign: formats.find((format) => format?.valign)?.valign,
});

export const setColumnFormat = (
  table: Y.Map<unknown>,
  columnId: string,
  patch: FormatPatch,
) => {
  const column = readTable(table).columns.find((item) => item.id === columnId);
  if (column) {
    updateColumn(table, columnId, {
      format: applyFormatPatch(column.format, patch),
    });
  }
};

const getRowYMap = (table: Y.Map<unknown>, rowId: string) => {
  const rows = getRowsArray(table);
  return rows.get(findIndex(rows, rowId)) as Y.Map<unknown> | undefined;
};

export const setRowFormat = (
  table: Y.Map<unknown>,
  rowId: string,
  patch: FormatPatch,
) => {
  table.doc?.transact(() => {
    const yrow = getRowYMap(table, rowId);
    if (!yrow) {
      return;
    }
    const format = applyFormatPatch(
      yrow.get('format') as CellFormat | undefined,
      patch,
    );
    if (format) {
      yrow.set('format', format);
    } else {
      yrow.delete('format');
    }
  });
};

export const setCellFormat = (
  table: Y.Map<unknown>,
  rowId: string,
  columnId: string,
  patch: FormatPatch,
) => {
  table.doc?.transact(() => {
    const yrow = getRowYMap(table, rowId);
    if (!yrow) {
      return;
    }
    let formats = yrow.get('cellFormats') as Y.Map<unknown> | undefined;
    const format = applyFormatPatch(
      formats?.get(columnId) as CellFormat | undefined,
      patch,
    );
    if (format) {
      if (!formats) {
        formats = new Y.Map<unknown>();
        yrow.set('cellFormats', formats);
      }
      formats.set(columnId, format);
    } else {
      formats?.delete(columnId);
    }
  });
};

/** Show or hide the row numbers, or format the header row or numbers column. */
export const setLayout = (
  table: Y.Map<unknown>,
  changes: Partial<TableLayout>,
) => {
  table.doc?.transact(() => {
    const layout = getLayout(table, true);
    Object.entries(changes).forEach(([key, value]) => layout?.set(key, value));
  });
};

/** Change the format of the header row or of the numbers column. */
export const setLayoutFormat = (
  table: Y.Map<unknown>,
  part: 'header' | 'numbers',
  patch: FormatPatch,
) => {
  const current = readTable(table).layout[part];
  setLayout(table, { [part]: applyFormatPatch(current, patch) ?? {} });
};
