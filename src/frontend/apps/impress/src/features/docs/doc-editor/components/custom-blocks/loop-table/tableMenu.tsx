import { DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import type { TFunction } from 'i18next';
import * as Y from 'yjs';
import { create } from 'zustand';

import { Icon } from '@/components';

import {
  HEADER_DEFAULTS,
  flatFormatEntries,
  summaryRowItem,
} from './formatMenu';
import {
  TableSnapshot,
  addColumn,
  addRow,
  setLayout,
  setLayoutFormat,
  updateColumn,
} from './model';

/** Opens a table's filter panel from outside it (the block's "⋮⋮" menu). */
export const useLoopTableUiStore = create<{
  filterFor: string | null;
  openFilter: (tableId: string) => void;
  clearFilterRequest: () => void;
}>((set) => ({
  filterFor: null,
  openFilter: (tableId) => set({ filterFor: tableId }),
  clearFilterRequest: () => set({ filterFor: null }),
}));

/**
 * What can be done to a table as a whole, in its block's "⋮⋮" menu: add a
 * row or a column, filter, show hidden columns, spread it into the margins,
 * and the colours and alignments of the header row and the numbers column
 * (which can be hidden).
 */
export const tableMenuItems = (
  t: TFunction<'translation', undefined>,
  table: Y.Map<unknown>,
  tableId: string,
  snapshot: TableSnapshot,
): DropdownMenuItem[] => {
  const hiddenColumns = snapshot.columns.filter((column) => column.hidden);
  const filters = snapshot.view.filters;
  return [
    {
      label: t('Add row', { description: 'Loop table menu' }),
      icon: <Icon iconName="add" $size="18px" />,
      callback: () => addRow(table),
    },
    {
      label: t('Add column', { description: 'Loop table menu' }),
      icon: <Icon iconName="view_column" $size="18px" />,
      callback: () => addColumn(table, snapshot.columns.length),
    },
    { type: 'separator' },
    {
      label: filters.length
        ? t('Filter ({{count}})', {
            description: 'Loop table menu, with the number of rules',
            count: filters.length,
          })
        : t('Filter', { description: 'Loop table menu' }),
      icon: <Icon iconName="filter_list" $size="18px" />,
      callback: () => useLoopTableUiStore.getState().openFilter(tableId),
    },
    {
      label: t('Hidden columns', { description: 'Loop table menu' }),
      icon: <Icon iconName="visibility_off" $size="18px" />,
      isHidden: hiddenColumns.length === 0,
      children: hiddenColumns.map((column) => ({
        label: t('Show {{name}}', {
          description: 'Shows a hidden column',
          name: column.name,
        }),
        icon: <Icon iconName="visibility" $size="18px" />,
        callback: () => updateColumn(table, column.id, { hidden: false }),
      })),
    },
    summaryRowItem(t, table, snapshot.layout),
    {
      label: snapshot.layout.expanded
        ? t('Fit to the page', { description: 'Loop table menu' })
        : t('Expand to margins', { description: 'Loop table menu' }),
      icon: (
        <Icon
          iconName={
            snapshot.layout.expanded ? 'close_fullscreen' : 'open_in_full'
          }
          $size="18px"
        />
      ),
      callback: () => setLayout(table, { expanded: !snapshot.layout.expanded }),
    },
    { type: 'separator' },
    // Two levels at most: the block menu can't open a third
    {
      label: t('All cells', { description: 'Loop table menu' }),
      icon: <Icon iconName="grid_on" $size="18px" />,
      children: flatFormatEntries(t, snapshot.layout.cells, (patch) =>
        setLayoutFormat(table, 'cells', patch),
      ),
    },
    {
      label: t('Header row', { description: 'Loop table menu' }),
      icon: <Icon iconName="table_rows" $size="18px" />,
      children: [
        // Collaborators: hidden from its handle, it comes back here
        {
          label: snapshot.layout.showHeader
            ? t('Hide the header row', {
                description: 'Loop table header row menu',
              })
            : t('Show the header row', {
                description: 'Loop table corner menu',
              }),
          icon: (
            <Icon
              iconName={
                snapshot.layout.showHeader ? 'visibility_off' : 'visibility'
              }
              $size="18px"
            />
          ),
          callback: () =>
            setLayout(table, { showHeader: !snapshot.layout.showHeader }),
        },
        { type: 'separator' },
        ...flatFormatEntries(
          t,
          snapshot.layout.header,
          (patch) => setLayoutFormat(table, 'header', patch),
          HEADER_DEFAULTS,
        ),
      ],
    },
    {
      label: t('Numbers column', { description: 'Loop table menu' }),
      icon: <Icon iconName="format_list_numbered" $size="18px" />,
      children: [
        {
          label: snapshot.layout.showRowNumbers
            ? t('Hide the numbers column', { description: 'Loop table menu' })
            : t('Show the numbers column', { description: 'Loop table menu' }),
          icon: (
            <Icon
              iconName={
                snapshot.layout.showRowNumbers ? 'visibility_off' : 'visibility'
              }
              $size="18px"
            />
          ),
          callback: () =>
            setLayout(table, {
              showRowNumbers: !snapshot.layout.showRowNumbers,
            }),
        },
        { type: 'separator' },
        ...flatFormatEntries(t, snapshot.layout.numbers, (patch) =>
          setLayoutFormat(table, 'numbers', patch),
        ),
      ],
    },
  ];
};
