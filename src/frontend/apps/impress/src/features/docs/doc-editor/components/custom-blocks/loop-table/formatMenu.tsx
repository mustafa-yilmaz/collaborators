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
  TextStyle,
  VerticalAlign,
  hasFormat,
  mergeFormats,
  setLayout,
  setLayoutFormat,
} from './model';
import { TEXT_COLORS } from './richText';

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

const textStyles = (t: T): [TextStyle, string, string][] => [
  ['bold', 'format_bold', t('Bold', { description: 'Text style' })],
  ['italic', 'format_italic', t('Italic', { description: 'Text style' })],
  [
    'underline',
    'format_underlined',
    t('Underline', { description: 'Text style' }),
  ],
  [
    'strike',
    'format_strikethrough',
    t('Strikethrough', { description: 'Text style' }),
  ],
];

const textColourName = (t: T, name: string) =>
  name === 'brown'
    ? t('Brown', { description: 'Text colour' })
    : colourName(t, name);

/** An "A" in a text colour, as in the editor's colour menu. */
const TextSwatch = ({ colour }: { colour?: string }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 16,
      height: 16,
      borderRadius: 4,
      border: '1px solid rgba(0, 0, 0, 0.15)',
      fontWeight: 700,
      fontSize: 12,
      color: colour ? TEXT_COLORS[colour]?.text : 'inherit',
    }}
  >
    A
  </span>
);

/**
 * Turning a style on or off. Collaborators: always chosen outright, the
 * latest choice winning over what covers the cell.
 */
export const toggleStyle = (
  style: TextStyle,
  shown: CellFormat,
): FormatPatch => ({ [style]: !shown[style] });

const textStyleEntries = (
  t: T,
  shown: CellFormat,
  onChange: (patch: FormatPatch) => void,
): DropdownMenuItem[] =>
  textStyles(t).map(([style, icon, label]) => ({
    label,
    icon: <Icon iconName={icon} $size="18px" />,
    isChecked: !!shown[style],
    callback: () => onChange(toggleStyle(style, shown)),
  }));

const textColourEntries = (
  t: T,
  shown: CellFormat,
  onChange: (patch: FormatPatch) => void,
): DropdownMenuItem[] => [
  {
    label: t('Default', { description: 'No text colour' }),
    icon: <TextSwatch />,
    isChecked: !shown.textColor,
    callback: () => onChange({ textColor: null }),
  },
  ...Object.keys(TEXT_COLORS).map((name) => ({
    label: textColourName(t, name),
    icon: <TextSwatch colour={name} />,
    isChecked: shown.textColor === name,
    callback: () => onChange({ textColor: name }),
  })),
];

/** Where text sits when nothing is chosen: left, and in the middle. */
export const DEFAULT_ALIGNMENT: CellFormat = {
  align: 'left',
  valign: 'middle',
};

/**
 * Menu entries changing the background colour, the text alignment, the text
 * style and the text colour of a column, a row, a cell, all the cells, the
 * header row or the numbers column. Horizontal and vertical alignments are
 * chosen apart, so both hold at once; so are the text styles.
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
      textStyle?: string;
      textColour?: string;
      clear?: string;
    };
    /** Collaborators: a cell's menu always ends with its "Clear", greyed
     * out while there is nothing to clear */
    isCell?: boolean;
  },
): DropdownMenuItem[] => {
  const inherited = mergeFormats(options?.shown, DEFAULT_ALIGNMENT);
  const shown = mergeFormats(format, inherited);
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
        labels?.textStyle ??
        t('Text style', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_bold" $size="18px" />,
      children: textStyleEntries(t, shown, onChange),
    },
    {
      label:
        labels?.textColour ??
        t('Text colour', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_color_text" $size="18px" />,
      children: textColourEntries(t, shown, onChange),
    },
    {
      label:
        labels?.clear ??
        t('Clear formatting', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_clear" $size="18px" />,
      isHidden: !options?.isCell && !hasFormat(format),
      isDisabled: !hasFormat(format),
      callback: () => onChange(CLEAR_FORMAT),
    },
  ];
};

/**
 * Collaborators: the menu of a cell (body, header or numbers cell): its own
 * format, over what it inherits, ending with "Clear cell formatting".
 */
export const cellFormatMenuItems = (
  t: T,
  format: CellFormat | undefined,
  onChange: (patch: FormatPatch) => void,
  shown: CellFormat,
): DropdownMenuItem[] =>
  formatMenuItems(t, format, onChange, {
    shown,
    isCell: true,
    labels: {
      clear: t('Clear cell formatting', {
        description: 'Loop table cell menu',
      }),
    },
  });

const textDecoration = (format: CellFormat) => {
  if (format.underline === undefined && format.strike === undefined) {
    return undefined;
  }
  const lines = [
    format.underline ? 'underline' : '',
    format.strike ? 'line-through' : '',
  ].filter(Boolean);
  return lines.length ? lines.join(' ') : 'none';
};

/** Inline styles of a cell (td or th) for a format. */
export const formatStyle = (format: CellFormat): React.CSSProperties => ({
  background: format.background,
  textAlign: format.align,
  verticalAlign: format.valign,
  fontWeight:
    format.bold === undefined ? undefined : format.bold ? 600 : 'normal',
  fontStyle:
    format.italic === undefined
      ? undefined
      : format.italic
        ? 'italic'
        : 'normal',
  textDecoration: textDecoration(format),
  color: format.textColor ? TEXT_COLORS[format.textColor]?.text : undefined,
});

/** A column's alignment when nothing is chosen: numbers sit on the right. */
export const columnDefaults = (column: Column): CellFormat => ({
  ...DEFAULT_ALIGNMENT,
  ...(column.type === ColumnType.NUMBER ? { align: 'right' } : {}),
});

/** Adds or takes away the row of sums, counts… under the rows. */
export const summaryRowItem = (
  t: T,
  table: Y.Map<unknown>,
  layout: TableLayout,
): DropdownMenuItem => ({
  label: layout.showSummary
    ? t('Remove the summary row', { description: 'Loop table menu' })
    : t('Add a summary row', { description: 'Loop table menu' }),
  icon: (
    <Icon iconName={layout.showSummary ? 'remove' : 'functions'} $size="18px" />
  ),
  callback: () => setLayout(table, { showSummary: !layout.showSummary }),
});

/** The header row is bold unless chosen otherwise. */
export const HEADER_DEFAULTS: CellFormat = { bold: true };

/**
 * The menu of the top-left corner, also in the toolbar: shows or hides the
 * row numbers, and formats all the cells, the header row and the numbers
 * column as a whole. All follow the same defaults as the columns: left, in
 * the middle.
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
  // Collaborators: the header row hides from its handle, and comes back here
  {
    label: layout.showHeader
      ? t('Hide the header row', { description: 'Loop table header row menu' })
      : t('Show the header row', { description: 'Loop table corner menu' }),
    icon: (
      <Icon
        iconName={layout.showHeader ? 'visibility_off' : 'table_rows'}
        $size="18px"
      />
    ),
    callback: () => setLayout(table, { showHeader: !layout.showHeader }),
  },
  summaryRowItem(t, table, layout),
  { type: 'separator' },
  {
    label: t('All cells', { description: 'Loop table corner menu' }),
    icon: <Icon iconName="grid_on" $size="18px" />,
    children: formatMenuItems(
      t,
      layout.cells,
      (patch) => setLayoutFormat(table, 'cells', patch),
      {
        labels: {
          clear: t('Clear the formatting of all cells', {
            description: 'Loop table corner menu',
          }),
        },
      },
    ),
  },
  {
    label: t('Header row', { description: 'Loop table corner menu' }),
    icon: <Icon iconName="table_rows" $size="18px" />,
    children: formatMenuItems(
      t,
      layout.header,
      (patch) => setLayoutFormat(table, 'header', patch),
      { shown: HEADER_DEFAULTS },
    ),
  },
  {
    label: t('Numbers column', { description: 'Loop table corner menu' }),
    icon: <Icon iconName="format_list_numbered" $size="18px" />,
    children: formatMenuItems(t, layout.numbers, (patch) =>
      setLayoutFormat(table, 'numbers', patch),
    ),
  },
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
  defaults?: CellFormat,
): DropdownMenuItem[] => {
  const inherited = mergeFormats(defaults, DEFAULT_ALIGNMENT);
  const shown = mergeFormats(format, inherited);
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
    { type: 'separator' },
    heading(t('Text style', { description: 'Loop table format menu' })),
    ...textStyleEntries(t, shown, onChange),
    { type: 'separator' },
    heading(t('Text colour', { description: 'Loop table format menu' })),
    ...textColourEntries(t, shown, onChange),
    {
      label: t('Clear formatting', { description: 'Loop table format menu' }),
      icon: <Icon iconName="format_clear" $size="18px" />,
      isHidden: !hasFormat(format),
      callback: () => onChange(CLEAR_FORMAT),
    },
  ];
};
