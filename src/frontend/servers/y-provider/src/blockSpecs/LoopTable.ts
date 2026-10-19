import { createBlockSpec } from '@blocknote/core';
import * as Y from 'yjs';

// Must stay in sync with the frontend LoopTableBlock
// (custom-blocks/loop-table/LoopTableBlock.tsx). The block only holds the id
// of its table; the table lives in the document's `loop-tables` Y.Map.
export const LoopTableBlock = createBlockSpec(
  {
    type: 'loopTable' as const,
    propSchema: { tableId: { default: '' } },
    content: 'none' as const,
  },
  {
    render: (block) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-content-type', 'loopTable');
      dom.setAttribute('data-table-id', block.props.tableId);
      return { dom };
    },
  },
);

const LOOP_TABLES_KEY = 'loop-tables';
const BUILTIN_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  'not-started': 'Not started',
  'in-progress': 'In progress',
  done: 'Done',
};

type Json = Record<string, unknown>;

/**
 * Inline elements of Text cells, "@[Label](kind:<id>)": people and groups
 * read as "@Label"; pages, dates, labels and images as their text.
 */
const TOKEN_RE = /@\[([^\]]+)\]\((user|group|page|date|label|image):[^)]+\)/g;

const plainCellText = (text: string) =>
  text.replace(TOKEN_RE, (_match, label: string, kind: string) =>
    kind === 'user' || kind === 'group' ? `@${label}` : label,
  );

const cellText = (value: unknown, type: unknown, labels: Json): string => {
  if (value instanceof Y.Text) {
    return plainCellText(value.toString());
  }
  if (value instanceof Y.Map) {
    return value.size ? String(value.size) : '';
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (type === 'label') {
    return String(labels[String(value)] ?? '');
  }
  if (type === 'person' && Array.isArray(value)) {
    return value
      .map((person) => String((person as Json).label ?? ''))
      .join(', ');
  }
  return String(value);
};

/** The rows of a Loop table as text, its header first. */
export const loopTableRows = (ydoc: Y.Doc, tableId: string): string[][] =>
  mapLoopTable(ydoc, tableId, String, cellText);

type InlineContent = Json[];

const STYLE_KEYS: Record<string, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strike',
  code: 'code',
  color: 'textColor',
  background: 'backgroundColor',
};

/**
 * A cell as BlockNote inline content: a Text cell keeps its formatting
 * (bold, italic, underline, strike, code, colours) and its links.
 */
const cellContent = (
  value: unknown,
  type: unknown,
  labels: Json,
): InlineContent => {
  if (!(value instanceof Y.Text)) {
    return [{ type: 'text', text: cellText(value, type, labels), styles: {} }];
  }
  return (value.toDelta() as { insert?: unknown; attributes?: Json }[])
    .filter((op) => typeof op.insert === 'string' && op.insert)
    .map((op) => {
      const attributes = op.attributes ?? {};
      const styles: Json = {};
      Object.entries(STYLE_KEYS).forEach(([key, style]) => {
        if (attributes[key]) {
          styles[style] = attributes[key];
        }
      });
      const text = { type: 'text', text: plainCellText(String(op.insert)), styles };
      const href = attributes.link;
      return typeof href === 'string' && /^(https?:|mailto:)/i.test(href)
        ? { type: 'link', href, content: [text] }
        : text;
    });
};

/** A Loop table, its header first, each cell mapped. */
const mapLoopTable = <T>(
  ydoc: Y.Doc,
  tableId: string,
  header: (name: string) => T,
  cell: (value: unknown, type: unknown, labels: Json) => T,
): T[][] => {
  const table = ydoc.getMap<Y.Map<unknown>>(LOOP_TABLES_KEY).get(tableId);
  if (!table) {
    return [];
  }
  const labels: Json = { ...BUILTIN_LABELS };
  const groups = table.get('labelGroups');
  if (groups instanceof Y.Map) {
    groups.forEach((group) => {
      const options = (group as Y.Map<unknown>).get('options');
      (Array.isArray(options) ? options : []).forEach((option: Json) => {
        labels[String(option.id)] = option.label;
      });
    });
  }
  const columns = (
    (table.get('columns') as Y.Array<Y.Map<unknown>> | undefined)?.toArray() ??
    []
  )
    .map((column) => column.toJSON())
    .filter((column) => !column.hidden);
  const rows =
    (table.get('rows') as Y.Array<Y.Map<unknown>> | undefined)?.toArray() ?? [];

  return [
    columns.map((column) => header(String(column.name ?? ''))),
    ...rows.map((row) => {
      const cells = row.get('cells') as Y.Map<unknown> | undefined;
      return columns.map((column) =>
        cell(cells?.get(String(column.id)), column.type, labels),
      );
    }),
  ];
};

type AnyBlock = {
  id?: string;
  type?: string;
  props?: Json;
  children?: AnyBlock[];
};

/**
 * Replace every loopTable block by a regular table block holding its values,
 * so that markdown and HTML outputs show the table.
 */
export const expandLoopTables = <B extends AnyBlock>(
  blocks: B[],
  ydoc: Y.Doc,
): B[] =>
  blocks.map((block) => {
    const children = block.children
      ? expandLoopTables(block.children, ydoc)
      : block.children;
    if (block.type !== 'loopTable') {
      return { ...block, children };
    }
    const rows = mapLoopTable<InlineContent>(
      ydoc,
      String(block.props?.tableId ?? ''),
      (name) => [{ type: 'text', text: name, styles: {} }],
      cellContent,
    );
    return {
      id: block.id,
      type: 'table',
      props: { textColor: 'default' },
      children: [],
      content: {
        type: 'tableContent',
        columnWidths: rows[0]?.map(() => undefined) ?? [],
        headerRows: 1,
        rows: rows.map((cells) => ({
          cells,
        })),
      },
    } as unknown as B;
  });
