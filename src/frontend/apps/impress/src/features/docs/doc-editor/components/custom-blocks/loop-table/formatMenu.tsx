import { DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import type { TFunction } from 'i18next';

import { Icon } from '@/components';

import {
  CLEAR_FORMAT,
  CellFormat,
  FormatPatch,
  HorizontalAlign,
  VerticalAlign,
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

/**
 * Menu entries changing the background colour and the text alignment of a
 * column, a row, a cell, the header row or the numbers column.
 */
export const formatMenuItems = (
  t: T,
  format: CellFormat | undefined,
  onChange: (patch: FormatPatch) => void,
  labels?: { background?: string; alignment?: string; clear?: string },
): DropdownMenuItem[] => [
  {
    label:
      labels?.background ??
      t('Background colour', { description: 'Loop table format menu' }),
    icon: <Icon iconName="format_color_fill" $size="18px" />,
    children: [
      {
        label: t('None', { description: 'No background colour' }),
        icon: <Swatch />,
        isChecked: !format?.background,
        callback: () => onChange({ background: null }),
      },
      ...BACKGROUND_COLOURS.map((colour) => ({
        label: colourName(t, colour.name),
        icon: <Swatch colour={colour.value} />,
        isChecked: format?.background === colour.value,
        callback: () => onChange({ background: colour.value }),
      })),
    ],
  },
  {
    label:
      labels?.alignment ??
      t('Text alignment', { description: 'Loop table format menu' }),
    icon: <Icon iconName="format_align_left" $size="18px" />,
    children: [
      ...horizontal(t).map(([value, icon, label]) => ({
        label,
        icon: <Icon iconName={icon} $size="18px" />,
        isChecked: format?.align === value,
        callback: () =>
          onChange({ align: format?.align === value ? null : value }),
      })),
      { type: 'separator' as const },
      ...vertical(t).map(([value, icon, label]) => ({
        label,
        icon: <Icon iconName={icon} $size="18px" />,
        isChecked: format?.valign === value,
        callback: () =>
          onChange({ valign: format?.valign === value ? null : value }),
      })),
    ],
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

/** Inline styles of a cell (td or th) for a format. */
export const formatStyle = (format: CellFormat): React.CSSProperties => ({
  background: format.background,
  textAlign: format.align,
  verticalAlign: format.valign,
});
