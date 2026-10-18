/**
 * Sort, filter and summaries of a Loop table. They are saved in the table's
 * view, so everyone who can see the page sees the same rows, like in Loop.
 */
import { formatCell, labelOptionsOf } from './format';
import {
  CellValue,
  Column,
  ColumnType,
  FilterOperator,
  FilterRule,
  PersonValue,
  Row,
  SummaryKind,
  TableSnapshot,
} from './model';

const isEmpty = (value: CellValue | undefined) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** Who "me" is, for the "Assigned to me" filter: my id and my teams. */
export interface Viewer {
  userId?: string;
  teams?: string[];
}

const matches = (
  rule: FilterRule,
  column: Column,
  value: CellValue | undefined,
  snapshot: TableSnapshot,
  viewer: Viewer,
) => {
  const text = formatCell(column, value, snapshot).toLowerCase();
  const target = (rule.value ?? '').toLowerCase();

  switch (rule.operator) {
    case 'empty':
      return isEmpty(value);
    case 'not_empty':
      return !isEmpty(value);
    case 'contains':
      return text.includes(target);
    case 'not_contains':
      return !text.includes(target);
    case 'is':
      return column.type === ColumnType.LABEL
        ? value === rule.value
        : column.type === ColumnType.DATE
          ? value === rule.value
          : text === target;
    case 'is_not':
      return column.type === ColumnType.LABEL
        ? value !== rule.value
        : text !== target;
    case 'gt':
      return typeof value === 'number' && value > Number(rule.value);
    case 'lt':
      return typeof value === 'number' && value < Number(rule.value);
    case 'before':
      return typeof value === 'string' && !!rule.value && value < rule.value;
    case 'after':
      return typeof value === 'string' && !!rule.value && value > rule.value;
    case 'includes_me':
      return (
        Array.isArray(value) &&
        (value as PersonValue[]).some(
          (person) =>
            (person.kind === 'user' && person.id === viewer.userId) ||
            (person.kind === 'group' && !!viewer.teams?.includes(person.id)),
        )
      );
    default:
      return true;
  }
};

/** Sort key of a cell: numbers and dates compare as such, the rest as text. */
const sortKey = (
  column: Column,
  value: CellValue | undefined,
  snapshot: TableSnapshot,
): number | string => {
  if (isEmpty(value)) {
    return '';
  }
  switch (column.type) {
    case ColumnType.NUMBER:
      return value as number;
    case ColumnType.VOTING:
      return (value as string[]).length;
    case ColumnType.DATE:
      return value as string;
    case ColumnType.LABEL:
      // Label options sort in their own order (Low < Medium < High)
      return labelOptionsOf(column, snapshot).findIndex(
        (option) => option.id === value,
      );
    default:
      return formatCell(column, value, snapshot).toLowerCase();
  }
};

/** The rows to show, filtered then sorted per the table's view. */
export const visibleRows = (
  snapshot: TableSnapshot,
  viewer: Viewer = {},
): Row[] => {
  const columnsById = new Map(
    snapshot.columns.map((column) => [column.id, column]),
  );
  const rules = snapshot.view.filters.filter((rule) =>
    columnsById.has(rule.columnId),
  );
  let rows = snapshot.rows.filter((row) =>
    rules.every((rule) => {
      const column = columnsById.get(rule.columnId);
      return column
        ? matches(rule, column, row.cells[rule.columnId], snapshot, viewer)
        : true;
    }),
  );

  const sort = snapshot.view.sort;
  const sortColumn = sort ? columnsById.get(sort.columnId) : undefined;
  if (sort && sortColumn) {
    const direction = sort.direction === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const ka = sortKey(sortColumn, a.cells[sortColumn.id], snapshot);
      const kb = sortKey(sortColumn, b.cells[sortColumn.id], snapshot);
      // Empty cells always go last
      if (ka === '' && kb !== '') {
        return 1;
      }
      if (kb === '' && ka !== '') {
        return -1;
      }
      if (typeof ka === 'number' && typeof kb === 'number') {
        return (ka - kb) * direction;
      }
      return String(ka).localeCompare(String(kb)) * direction;
    });
  }
  return rows;
};

export const operatorsFor = (type: ColumnType): FilterOperator[] => {
  switch (type) {
    case ColumnType.NUMBER:
      return ['is', 'gt', 'lt', 'empty', 'not_empty'];
    case ColumnType.DATE:
      return ['is', 'before', 'after', 'empty', 'not_empty'];
    case ColumnType.LABEL:
      return ['is', 'is_not', 'empty', 'not_empty'];
    case ColumnType.PERSON:
      return ['includes_me', 'contains', 'empty', 'not_empty'];
    case ColumnType.VOTING:
      return ['not_empty', 'empty'];
    default:
      return ['contains', 'not_contains', 'is', 'empty', 'not_empty'];
  }
};

export const summaryKindsFor = (type: ColumnType): SummaryKind[] => {
  switch (type) {
    case ColumnType.NUMBER:
      return [
        SummaryKind.NONE,
        SummaryKind.SUM,
        SummaryKind.AVERAGE,
        SummaryKind.COUNT,
        SummaryKind.MIN,
        SummaryKind.MAX,
      ];
    case ColumnType.VOTING:
      return [SummaryKind.NONE, SummaryKind.SUM, SummaryKind.COUNT];
    default:
      return [SummaryKind.NONE, SummaryKind.COUNT];
  }
};

/** Default summary: Loop sums number columns and counts people per person. */
export const defaultSummary = (type: ColumnType): SummaryKind =>
  type === ColumnType.NUMBER ? SummaryKind.SUM : SummaryKind.NONE;

export interface SummaryResult {
  kind: SummaryKind;
  value: number | null;
  /** For person columns: how many rows each person or group appears in. */
  perPerson?: { label: string; count: number }[];
}

export const summarize = (
  column: Column,
  rows: Row[],
  kind: SummaryKind,
): SummaryResult => {
  const values = rows.map((row) => row.cells[column.id]);
  const filled = values.filter((value) => !isEmpty(value));

  if (column.type === ColumnType.PERSON) {
    const counts = new Map<string, number>();
    filled.forEach((value) =>
      (value as PersonValue[]).forEach((person) =>
        counts.set(person.label, (counts.get(person.label) ?? 0) + 1),
      ),
    );
    return {
      kind,
      value: kind === SummaryKind.COUNT ? filled.length : null,
      perPerson: Array.from(counts, ([label, count]) => ({ label, count })),
    };
  }

  const numbers =
    column.type === ColumnType.VOTING
      ? values.map((value) => (Array.isArray(value) ? value.length : 0))
      : filled.filter((value): value is number => typeof value === 'number');

  switch (kind) {
    case SummaryKind.SUM:
      return { kind, value: numbers.reduce((a, b) => a + b, 0) };
    case SummaryKind.AVERAGE:
      return {
        kind,
        value: numbers.length
          ? numbers.reduce((a, b) => a + b, 0) / numbers.length
          : null,
      };
    case SummaryKind.MIN:
      return { kind, value: numbers.length ? Math.min(...numbers) : null };
    case SummaryKind.MAX:
      return { kind, value: numbers.length ? Math.max(...numbers) : null };
    case SummaryKind.COUNT:
      return { kind, value: filled.length };
    default:
      return { kind, value: null };
  }
};
