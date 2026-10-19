import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react';
import { DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { useProviderStore } from '@/docs/doc-management';

import type { DocsBlockNoteEditor } from '../../types';
import type { MenuHeading } from '../custom-blocks/loop-table/formatMenu';
import { tableMenuItems } from '../custom-blocks/loop-table/tableMenu';
import { useLoopTable } from '../custom-blocks/loop-table/useLoopTable';

/** Our menu entries, drawn with the editor's own menu pieces. */
const MenuEntries = ({ items }: { items: DropdownMenuItem[] }) => {
  const Components = useComponentsContext();
  if (!Components) {
    return null;
  }
  return (
    <>
      {items.map((item, index) => {
        if ('type' in item && item.type === 'separator') {
          return <Components.Generic.Menu.Divider key={index} />;
        }
        if ('isHeading' in item) {
          return (
            <Components.Generic.Menu.Label key={index}>
              {(item as MenuHeading).label}
            </Components.Generic.Menu.Label>
          );
        }
        const entry = item as Exclude<DropdownMenuItem, { type: 'separator' }>;
        if (entry.isHidden) {
          return null;
        }
        const content = (
          <Box $align="center" $gap="xxs" $direction="row">
            {entry.icon}
            {entry.label}
          </Box>
        );
        if (entry.children?.length) {
          return (
            <Components.Generic.Menu.Root
              key={index}
              position="right"
              sub={true}
            >
              <Components.Generic.Menu.Trigger sub={true}>
                <Components.Generic.Menu.Item
                  className="bn-menu-item"
                  subTrigger={true}
                >
                  {content}
                </Components.Generic.Menu.Item>
              </Components.Generic.Menu.Trigger>
              <Components.Generic.Menu.Dropdown
                sub={true}
                className="bn-menu-dropdown"
              >
                <MenuEntries items={entry.children} />
              </Components.Generic.Menu.Dropdown>
            </Components.Generic.Menu.Root>
          );
        }
        return (
          <Fragment key={index}>
            <Components.Generic.Menu.Item
              className="bn-menu-item"
              checked={entry.isChecked}
              onClick={entry.isDisabled ? undefined : entry.callback}
            >
              {content}
            </Components.Generic.Menu.Item>
          </Fragment>
        );
      })}
    </>
  );
};

/**
 * Collaborators: a Loop table's actions as a whole (add a row or a column,
 * filter, hidden columns, header row and numbers column) in its block's
 * "⋮⋮" menu, the one that shows when the pointer comes near the block.
 */
export const LoopTableMenuItems = () => {
  const { t } = useTranslation();
  const Components = useComponentsContext();
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });
  const ydoc = useProviderStore((state) => state.provider?.doc ?? null);
  const tableId =
    block?.type === 'loopTable'
      ? ((block.props as { tableId?: string }).tableId ?? '')
      : '';
  const { table, snapshot } = useLoopTable(tableId ? ydoc : null, tableId);

  if (!Components || !tableId || !table || !snapshot) {
    return null;
  }

  return (
    <>
      <MenuEntries items={tableMenuItems(t, table, tableId, snapshot)} />
      <Components.Generic.Menu.Divider />
    </>
  );
};
