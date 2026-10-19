import { DropdownMenu } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import { formatStyle, layoutMenuItems } from './formatMenu';
import { TableSnapshot, mergeFormats } from './model';

/**
 * The top-left cell, where the header row and the numbers column cross, shown
 * with the numbers column. Its menu, also in the toolbar, shows or hides the
 * row numbers, and formats the header row and the numbers column as a whole.
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

  if (!isEditable) {
    return (
      <th
        className="loop-table__rownum"
        aria-label="#"
        style={formatStyle(look)}
      />
    );
  }

  return (
    <th className="loop-table__rownum" style={formatStyle(look)}>
      <DropdownMenu
        options={layoutMenuItems(t, table, layout)}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      >
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
