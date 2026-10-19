import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import { formatMenuItems, formatStyle } from './formatMenu';
import {
  TableSnapshot,
  mergeFormats,
  setLayout,
  setLayoutFormat,
} from './model';

/**
 * The top-left cell, where the header row and the numbers column cross: its
 * menu shows or hides the row numbers, and formats the header row and the
 * numbers column as a whole.
 */
export const CornerHeader = ({
  table,
  snapshot,
  isEditable,
}: {
  table: Y.Map<unknown>;
  snapshot: TableSnapshot;
  isEditable: boolean;
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { layout } = snapshot;
  const look = mergeFormats(layout.header, layout.numbers);
  const className = `loop-table__rownum ${layout.showRowNumbers ? '' : 'is-numbers-hidden'}`;

  if (!isEditable) {
    return (
      <th className={className} aria-label="#" style={formatStyle(look)} />
    );
  }

  const options: DropdownMenuItem[] = [
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
        // Row numbers sit in the middle of their cell unless chosen otherwise
        shown: { align: 'center', valign: 'middle' },
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

  return (
    <th className={className} style={formatStyle(look)}>
      <DropdownMenu options={options} isOpen={isOpen} onOpenChange={setIsOpen}>
        <button
          type="button"
          className="loop-table__corner"
          aria-label={t('Header row and numbers column options', {
            description: 'Accessible name of the Loop table corner menu',
          })}
          title={t('Header row and numbers column options', {
            description: 'Accessible name of the Loop table corner menu',
          })}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Icon iconName="expand_more" $size="16px" />
        </button>
      </DropdownMenu>
    </th>
  );
};
