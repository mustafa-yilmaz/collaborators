import { SideMenuExtension } from '@blocknote/core/extensions';
import {
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from '@blocknote/react';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { isMacOS } from '@/utils/userAgent';

import type { DocsBlockNoteEditor } from '../../types';
import { animateLanding, blockTops } from '../BlockMotion/motion';

/**
 * Collaborators: "Move up" and "Move down" in a block's "⠿" menu, with
 * their keyboard shortcuts; the block slides to its new place.
 */
export const MoveBlockItems = () => {
  const { t } = useTranslation();
  const Components = useComponentsContext();
  const editor: DocsBlockNoteEditor = useBlockNoteEditor();
  const blockId = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block?.id,
  });

  if (Components === undefined || !blockId) {
    return null;
  }

  const modifier = isMacOS ? '⌘ ⇧' : 'Ctrl ⇧';
  const move = (direction: 'up' | 'down') => {
    const root = editor.domElement;
    const before = root
      ? blockTops(root, [blockId])
      : new Map<string, number>();
    if (direction === 'up') {
      editor.moveBlocksUp(blockId);
    } else {
      editor.moveBlocksDown(blockId);
    }
    if (root) {
      animateLanding(root, [blockId], before);
    }
  };

  const item = (
    direction: 'up' | 'down',
    icon: string,
    label: string,
    keys: string,
  ) => (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => move(direction)}
    >
      <Box $align="center" $gap="xxs" $direction="row" $width="100%">
        <Icon iconName={icon} $size="16px" />
        {label}
        <Text
          $margin={{ left: 'auto' }}
          $size="xs"
          $variation="tertiary"
          aria-hidden="true"
        >
          {keys}
        </Text>
      </Box>
    </Components.Generic.Menu.Item>
  );

  return (
    <>
      {item(
        'up',
        'arrow_upward',
        t('Move up', { description: 'Block menu item moving the block up' }),
        `${modifier} ↑`,
      )}
      {item(
        'down',
        'arrow_downward',
        t('Move down', {
          description: 'Block menu item moving the block down',
        }),
        `${modifier} ↓`,
      )}
    </>
  );
};
