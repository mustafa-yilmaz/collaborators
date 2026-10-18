import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { createReactBlockSpec } from '@blocknote/react';
import type { TFunction } from 'i18next';
import { useEffect } from 'react';

import { Icon } from '@/components';

import type { DocsBlockNoteEditor } from '../../../types';

import { useLoopTableDoc } from './LoopTableContext';
import { LoopTableView } from './LoopTableView';
import { createTable } from './model';

/**
 * A Loop-style table: typed columns, sort, filter, summaries. The block only
 * stores the id of its table, whose data lives in the page's Y.Doc (see
 * model.ts), so cells are edited collaboratively one by one.
 */
export const LoopTableBlock = createReactBlockSpec(
  {
    type: 'loopTable',
    propSchema: {
      tableId: { default: '' },
    },
    content: 'none',
  },
  {
    render: ({ block, editor }) => (
      <LoopTableBlockRender
        tableId={block.props.tableId}
        isEditable={editor.isEditable}
        onCreated={(tableId) =>
          editor.updateBlock(block, { props: { tableId } })
        }
      />
    ),
  },
);

const LoopTableBlockRender = ({
  tableId,
  isEditable,
  onCreated,
}: {
  tableId: string;
  isEditable: boolean;
  onCreated: (tableId: string) => void;
}) => {
  const ydoc = useLoopTableDoc();

  // A freshly inserted block gets its table
  useEffect(() => {
    if (!tableId && ydoc && isEditable) {
      const id = createTable(ydoc);
      // Delay the update to avoid interfering with the block insertion
      setTimeout(() => onCreated(id), 0);
    }
  }, [tableId, ydoc, isEditable, onCreated]);

  return (
    <LoopTableView ydoc={ydoc} tableId={tableId} isEditable={isEditable} />
  );
};

export const getLoopTableReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    key: 'loopTable',
    title: t('Table', {
      description: 'Name of the editor block type: a Loop-style table',
    }),
    onItemClick: () => {
      insertOrUpdateBlockForSlashMenu(editor, { type: 'loopTable' });
    },
    aliases: ['table', 'loop', 'grid', 'database', 'tablo'],
    group,
    icon: <Icon iconName="table_view" $size="18px" />,
    subtext: t('Typed columns, sort, filter and summaries', {
      description: 'Description of the Loop table block in the slash menu',
    }),
  },
];
