import { plainText } from './mentions';
import {
  CellValue,
  Column,
  ColumnType,
  LabelOption,
  NumberFormat,
  PersonValue,
  TableSnapshot,
  allLabelGroups,
} from './model';

export const labelOptionsOf = (
  column: Column,
  snapshot: TableSnapshot,
): LabelOption[] =>
  allLabelGroups(snapshot).find((group) => group.id === column.labelGroupId)
    ?.options ?? [];

export const formatNumber = (
  value: number,
  format: NumberFormat = NumberFormat.PLAIN,
  currency = 'EUR',
) => {
  switch (format) {
    case NumberFormat.DECIMAL:
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    case NumberFormat.PERCENT:
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} %`;
    case NumberFormat.CURRENCY:
      return value.toLocaleString(undefined, { style: 'currency', currency });
    default:
      return value.toLocaleString();
  }
};

/** Like Loop: the year is left out for dates of the current year. */
export const formatDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
};

/** The value of a cell as text, as shown, exported and searched. */
export const formatCell = (
  column: Column,
  value: CellValue | undefined,
  snapshot: TableSnapshot,
): string => {
  if (value === null || value === undefined) {
    return '';
  }
  switch (column.type) {
    case ColumnType.NUMBER:
      return typeof value === 'number'
        ? formatNumber(value, column.numberFormat, column.currency)
        : '';
    case ColumnType.DATE:
      return typeof value === 'string' && value ? formatDate(value) : '';
    case ColumnType.PERSON:
      return Array.isArray(value)
        ? (value as PersonValue[]).map((person) => person.label).join(', ')
        : '';
    case ColumnType.LABEL:
      return (
        labelOptionsOf(column, snapshot).find((option) => option.id === value)
          ?.label ?? ''
      );
    case ColumnType.VOTING:
      return Array.isArray(value) && value.length ? String(value.length) : '';
    default:
      return plainText(String(value));
  }
};
