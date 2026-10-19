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

const cellText = (value: unknown, type: unknown, labels: Json): string => {
  if (value instanceof Y.Text) {
    // Mentions written "@[Label](user:<id>)" read as "@Label"
    return value
      .toString()
      .replace(/@\[([^\]]+)\]\((?:user|group):[^)]+\)/g, '@$1');
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
export const loopTableRows = (ydoc: Y.Doc, tableId: string): string[][] => {
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
    columns.map((column) => String(column.name ?? '')),
    ...rows.map((row) => {
      const cells = row.get('cells') as Y.Map<unknown> | undefined;
      return columns.map((column) =>
        cellText(cells?.get(String(column.id)), column.type, labels),
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
    const rows = loopTableRows(ydoc, String(block.props?.tableId ?? ''));
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
          cells: cells.map((text) => [{ type: 'text', text, styles: {} }]),
        })),
      },
    } as unknown as B;
  });
