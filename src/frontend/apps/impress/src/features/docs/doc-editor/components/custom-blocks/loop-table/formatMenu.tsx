import { DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import type { TFunction } from 'i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import {
  CLEAR_FORMAT,
  CellFormat,
  Column,
  ColumnType,
  FormatPatch,
  HorizontalAlign,
  TableLayout,
  VerticalAlign,
  mergeFormats,
  setLayout,
  setLayoutFormat,
} from './model';

/** Light colours that keep text readable, as in Loop. */
export const BACKGROUND_COLOURS = [
  { value: '#f1f1ef', name: 'gray' },
  { value: '#fbe4e4', name: 'red' },
  { value: '#fbecdd', name: 'orange' },
  { value: '#fbf3db', name: 'yellow' },
  { value: '#e6f3e8', name: 'green' },
  { value: '#e1f1f1', name: 'teal' },
  { value: '#e3edf8', name: 'blue' },
  { value: '#ede6f6', name: 'purple' },
  { value: '#f8e5ef', name: 'pink' },
] as const;

type T = TFunction<'translation', undefined>;

const colourName = (t: T, name: string) => {
  switch (name) {
    case 'gray':
      return t('Gray', { description: 'Background colour' });
    case 'red':
      return t('Red', { description: 'Background colour' });
    case 'orange':
      return t('Orange', { description: 'Background colour' });
    case 'yellow':
      return t('Yellow', { description: 'Background colour' });
    case 'green':
      return t('Green', { description: 'Background colour' });
    case 'teal':
      return t('Teal', { description: 'Background colour' });
    case 'blue':
      return t('Blue', { description: 'Background colour' });
    case 'purple':
      return t('Purple', { description: 'Background colour' });
    default:
      return t('Pink', { description: 'Background colour' });
  }
};

const Swatch = ({ colour }: { colour?: string }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 16,
      height: 16,
      borderRadius: 4,
      background: colour ?? 'transparent',
      border: '1px solid rgba(0, 0, 0, 0.15)',
    }}
  />
);

const horizontal = (t: T): [HorizontalAlign, string, string][] => [
  ['left', 'format_align_left', t('Left', { description: 'Text alignment' })],
  [
    'center',
    'format_align_center',
    t('Center', { description: 'Text alignment' }),
  ],
  [
    'right',
    'format_align_right',
    t('Right', { description: 'Text alignment' }),
  ],
];

const vertical = (t: T): [VerticalAlign, string, string][] => [
  ['top', 'vertical_align_top', t('Top', { description: 'Text alignment' })],
  [
    'middle',
    'vertical_align_center',
    t('Middle', { description: 'Text alignment' }),
  ],
  [
    'bottom',
    'vertical_align_bottom',
    t('Bottom', { description: 'Text alignment' }),
  ],
];

/** Where text sits when nothing is chosen: left, and in the middle. */
export const DEFAULT_ALIGNMENT: CellFormat = {
  align: 'left',
  valign: 'middle',
};

/**
 * Menu entries changing the background colour and the text alignment of a
 * column, a row, a cell, the header row or the numbers column. Horizontal and
 * vertical alignments are chosen apart, so both hold at once.
 *
 * `format` is the element's own format; `shown` is what applies to it, its
 * own format completed by what it inherits and the defaults, which the menu
 * ticks.
 */
export const formatMenuItems = (
  t: T,
  format: CellFormat | undefined,
  onChange: (patch: FormatPatch) => void,
  options?: {
    shown?: CellFormat;
    labels?: {
      background?: string;
      horizontal?: string;
      vertical?: string;
      clear?: string;
    };
  },
): DropdownMenuItem[] => {
  const shown = mergeFormats(format, options?.shown, DEFAULT_ALIGNMENT);
  const labels = options?.labels;
  return [
    {
      label:
        labels?.background ??
        t('Background colour', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_color_fill" $size="18px" />,
      children: [
        {
          label: t('None', { description: 'No background colour' }),
          icon: <Swatch />,
          isChecked: !shown.background,
          callback: () => onChange({ background: null }),
        },
        ...BACKGROUND_COLOURS.map((colour) => ({
          label: colourName(t, colour.name),
          icon: <Swatch colour={colour.value} />,
          isChecked: shown.background === colour.value,
          callback: () => onChange({ background: colour.value }),
        })),
      ],
    },
    {
      label:
        labels?.horizontal ??
        t('Horizontal alignment', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_align_left" $size="18px" />,
      children: horizontal(t).map(([value, icon, label]) => ({
        label,
        icon: <Icon iconName={icon} $size="18px" />,
        isChecked: shown.align === value,
        callback: () => onChange({ align: value }),
      })),
    },
    {
      label:
        labels?.vertical ??
        t('Vertical alignment', { description: 'Loop table format menu' }),
      icon: <Icon iconName="vertical_align_center" $size="18px" />,
      children: vertical(t).map(([value, icon, label]) => ({
        label,
        icon: <Icon iconName={icon} $size="18px" />,
        isChecked: shown.valign === value,
        callback: () => onChange({ valign: value }),
      })),
    },
    {
      label:
        labels?.clear ??
        t('Clear formatting', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_clear" $size="18px" />,
      isHidden: !format?.background && !format?.align && !format?.valign,
      callback: () => onChange(CLEAR_FORMAT),
    },
  ];
};

/** Inline styles of a cell (td or th) for a format. */
export const formatStyle = (format: CellFormat): React.CSSProperties => ({
  background: format.background,
  textAlign: format.align,
  verticalAlign: format.valign,
});

/** A column's alignment when nothing is chosen: numbers sit on the right. */
export const columnDefaults = (column: Column): CellFormat => ({
  ...DEFAULT_ALIGNMENT,
  ...(column.type === ColumnType.NUMBER ? { align: 'right' } : {}),
});

/**
 * The menu of the top-left corner, also in the toolbar: shows or hides the
 * row numbers, and formats the header row and the numbers column as a whole.
 * Both follow the same defaults as the other columns: left, in the middle.
 */
export const layoutMenuItems = (
  t: T,
  table: Y.Map<unknown>,
  layout: TableLayout,
): DropdownMenuItem[] => [
  {
    label: layout.showRowNumbers
      ? t('Hide the numbers column', {
          description: 'Loop table corner menu',
        })
      : t('Show the numbers column', {
          description: 'Loop table corner menu',
        }),
    icon: (
      <Icon
        iconName={
          layout.showRowNumbers ? 'visibility_off' : 'format_list_numbered'
        }
        $size="18px"
      />
    ),
    callback: () =>
      setLayout(table, { showRowNumbers: !layout.showRowNumbers }),
  },
  { type: 'separator' },
  ...formatMenuItems(
    t,
    layout.header,
    (patch) => setLayoutFormat(table, 'header', patch),
    {
      labels: {
        background: t('Header row colour', {
          description: 'Loop table corner menu',
        }),
        horizontal: t('Header row horizontal alignment', {
          description: 'Loop table corner menu',
        }),
        vertical: t('Header row vertical alignment', {
          description: 'Loop table corner menu',
        }),
        clear: t('Clear header row formatting', {
          description: 'Loop table corner menu',
        }),
      },
    },
  ),
  { type: 'separator' },
  ...formatMenuItems(
    t,
    layout.numbers,
    (patch) => setLayoutFormat(table, 'numbers', patch),
    {
      labels: {
        background: t('Numbers column colour', {
          description: 'Loop table corner menu',
        }),
        horizontal: t('Numbers column horizontal alignment', {
          description: 'Loop table corner menu',
        }),
        vertical: t('Numbers column vertical alignment', {
          description: 'Loop table corner menu',
        }),
        clear: t('Clear numbers column formatting', {
          description: 'Loop table corner menu',
        }),
      },
    },
  ),
];

/** A heading inside a menu (drawn as a label by the block menu). */
export type MenuHeading = { label: string; isHeading: true };

/**
 * The colour and alignment choices in one list, each group under a heading,
 * for menus that can't open a third level (the block's "⋮⋮" menu).
 */
export const flatFormatEntries = (
  t: T,
  format: CellFormat | undefined,
  onChange: (patch: FormatPatch) => void,
): DropdownMenuItem[] => {
  const shown = mergeFormats(format, DEFAULT_ALIGNMENT);
  const heading = (label: string) =>
    ({ label, isHeading: true }) as unknown as DropdownMenuItem;
  return [
    heading(t('Colour', { description: 'Heading of the colours in a menu' })),
    {
      label: t('None', { description: 'No background colour' }),
      icon: <Swatch />,
      isChecked: !shown.background,
      callback: () => onChange({ background: null }),
    },
    ...BACKGROUND_COLOURS.map((colour) => ({
      label: colourName(t, colour.name),
      icon: <Swatch colour={colour.value} />,
      isChecked: shown.background === colour.value,
      callback: () => onChange({ background: colour.value }),
    })),
    { type: 'separator' },
    heading(
      t('Horizontal alignment', { description: 'Loop table format menu' }),
    ),
    ...horizontal(t).map(([value, icon, label]) => ({
      label,
      icon: <Icon iconName={icon} $size="18px" />,
      isChecked: shown.align === value,
      callback: () => onChange({ align: value }),
    })),
    { type: 'separator' },
    heading(t('Vertical alignment', { description: 'Loop table format menu' })),
    ...vertical(t).map(([value, icon, label]) => ({
      label,
      icon: <Icon iconName={icon} $size="18px" />,
      isChecked: shown.valign === value,
      callback: () => onChange({ valign: value }),
    })),
    {
      label: t('Clear formatting', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_clear" $size="18px" />,
      isHidden: !format?.background && !format?.align && !format?.valign,
      callback: () => onChange(CLEAR_FORMAT),
    },
  ];
};
