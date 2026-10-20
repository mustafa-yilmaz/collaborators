/**
 * Loop tables seen by everything that reads the document's blocks rather than
 * its Y.Doc (exports, printing): a loopTable block becomes a regular table
 * block holding the displayed values.
 */
import { useProviderStore } from '@/features/docs/doc-management/stores/useProviderStore';

import { formatCell } from './format';
import { BACKGROUND_COLOURS } from './formatMenu';
import {
  CellFormat,
  TEXT_STYLES,
  TableSnapshot,
  cellLook,
  getTable,
  mergeFormats,
  readTable,
} from './model';
import { visibleRows } from './view';

interface LoopTableBlockLike {
  id: string;
  props: { tableId?: string };
}

/** A cell's text, with the text style of its format. */
const styledText = (text: string, format?: CellFormat) => [
  {
    type: 'text' as const,
    text,
    styles: Object.fromEntries(
      TEXT_STYLES.filter((style) => format?.[style]).map((style) => [
        style,
        true,
      ]),
    ),
  },
];

/** The snapshot of a table of the page being edited, if available. */
export const getLoopTableSnapshot = (
  tableId: string | undefined,
): TableSnapshot | undefined => {
  const ydoc = useProviderStore.getState().provider?.doc;
  if (!ydoc || !tableId) {
    return undefined;
  }
  const table = getTable(ydoc, tableId);
  return table ? readTable(table) : undefined;
};

/** The rows of a table as text: a header row, then one row per visible row. */
export const loopTableToTextRows = (snapshot: TableSnapshot) => {
  const columns = snapshot.columns.filter((column) => !column.hidden);
  return [
    columns.map((column) => column.name),
    ...visibleRows(snapshot).map((row) =>
      columns.map((column) =>
        formatCell(column, row.cells[column.id], snapshot),
      ),
    ),
  ];
};

/**
 * The format of every exported cell, row by row like loopTableToTextRows:
 * the header row, then the visible rows.
 */
export const loopTableFormats = (snapshot: TableSnapshot): CellFormat[][] => {
  const columns = snapshot.columns.filter((column) => !column.hidden);
  return [
    columns.map((column) =>
      mergeFormats(snapshot.layout.header, column.format),
    ),
    ...visibleRows(snapshot).map((row) =>
      columns.map((column) => cellLook(snapshot, row, column)),
    ),
  ];
};

/** BlockNote names its colours; teal has no match and goes with blue. */
const blockNoteColour = (background?: string) => {
  const name = BACKGROUND_COLOURS.find(
    (colour) => colour.value === background,
  )?.name;
  return !name ? 'default' : name === 'teal' ? 'blue' : name;
};

/** A regular BlockNote table block with the values of a Loop table. */
export const loopTableAsTableBlock = (block: LoopTableBlockLike) => {
  const snapshot = getLoopTableSnapshot(block.props.tableId);
  const rows = snapshot ? loopTableToTextRows(snapshot) : [['']];
  const formats = snapshot ? loopTableFormats(snapshot) : [];
  const widths = snapshot
    ? snapshot.columns
        .filter((column) => !column.hidden)
        .map((column) => column.width)
    : [undefined];

  return {
    id: block.id,
    type: 'table' as const,
    props: { textColor: 'default' as const },
    children: [],
    content: {
      type: 'tableContent' as const,
      columnWidths: widths,
      headerRows: 1,
      rows: rows.map((cells, rowIndex) => ({
        cells: cells.map((text, columnIndex) => ({
          type: 'tableCell' as const,
          props: {
            backgroundColor: blockNoteColour(
              formats[rowIndex]?.[columnIndex]?.background,
            ),
            textColor: formats[rowIndex]?.[columnIndex]?.textColor ?? 'default',
            textAlignment: formats[rowIndex]?.[columnIndex]?.align ?? 'left',
            colspan: 1,
            rowspan: 1,
          },
          content: styledText(text, formats[rowIndex]?.[columnIndex]),
        })),
      })),
    },
  };
};

/** Give an exporter's mappings a loopTable mapping reusing its table one. */
export const withLoopTableMapping = <
  M extends { blockMapping: Record<string, unknown> },
>(
  mappings: Omit<M, 'blockMapping'> & {
    blockMapping: Omit<M['blockMapping'], 'loopTable'>;
  },
): M => {
  const tableMapping = (mappings.blockMapping as Record<string, unknown>)
    .table as (block: unknown, ...rest: unknown[]) => unknown;
  return {
    ...mappings,
    blockMapping: {
      ...mappings.blockMapping,
      loopTable: (block: LoopTableBlockLike, ...rest: unknown[]) =>
        tableMapping(loopTableAsTableBlock(block), ...rest),
    },
  } as unknown as M;
};
