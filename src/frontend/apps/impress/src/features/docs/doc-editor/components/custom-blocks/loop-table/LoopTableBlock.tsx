import { insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import { createReactBlockSpec } from '@blocknote/react';
import type { TFunction } from 'i18next';
import { useEffect, useRef } from 'react';

import { Icon } from '@/components';

import type { DocsBlockNoteEditor } from '../../../types';

import { useLoopTableDoc } from './LoopTableContext';
import { LoopTableView } from './LoopTableView';
import { cloneTable, createTable, getTable, readTable } from './model';

interface BlockLike {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: BlockLike[];
}

/** Ids of the other blocks of the page that point to the same table. */
const otherBlocksWithTable = (
  blocks: BlockLike[],
  tableId: string,
  ownId: string,
): string[] =>
  blocks.flatMap((block) => [
    ...(block.type === 'loopTable' &&
    block.props.tableId === tableId &&
    block.id !== ownId
      ? [block.id]
      : []),
    ...otherBlocksWithTable(block.children, tableId, ownId),
  ]);

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
        blockId={block.id}
        tableId={block.props.tableId}
        isEditable={editor.isEditable}
        getDocument={() => editor.document}
        setTableId={(tableId) =>
          editor.updateBlock(block, { props: { tableId } })
        }
      />
    ),
  },
);

const LoopTableBlockRender = ({
  blockId,
  tableId,
  isEditable,
  getDocument,
  setTableId,
}: {
  blockId: string;
  tableId: string;
  isEditable: boolean;
  getDocument: () => BlockLike[];
  setTableId: (tableId: string) => void;
}) => {
  const ydoc = useLoopTableDoc();
  // The table id this block already checked, so that re-renders before the
  // block update lands don't create or copy the table twice
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ydoc || !isEditable || handledRef.current === tableId) {
      return;
    }
    handledRef.current = tableId;
    // A freshly inserted block gets its table
    if (!tableId) {
      const id = createTable(ydoc);
      // Delay the update to avoid interfering with the block insertion
      setTimeout(() => setTableId(id), 0);
      return;
    }
    // A block copied (or duplicated) in the same page gets its own copy of
    // the table, rather than editing the original's. Of the blocks sharing a
    // table, all but the one with the smallest id make a copy, so every
    // client picks the same ones.
    const table = getTable(ydoc, tableId);
    const others = otherBlocksWithTable(getDocument(), tableId, blockId);
    const isCopy = others.length > 0 && others.some((id) => id < blockId);
    if (table && isCopy) {
      const id = cloneTable(ydoc, readTable(table));
      setTimeout(() => setTableId(id), 0);
    }
  }, [tableId, ydoc, isEditable, blockId, getDocument, setTableId]);

  return (
    <LoopTableView
      ydoc={ydoc}
      tableId={tableId}
      isEditable={isEditable}
      onRecreate={() => ydoc && setTableId(createTable(ydoc))}
    />
  );
};

export const getLoopTableReactSlashMenuItems = (
  editor: DocsBlockNoteEditor,
  t: TFunction<'translation', undefined>,
  group: string,
) => [
  {
    key: 'loopTable',
    // Not just "Table": BlockNote's simple table already has that title, and
    // the slash menu tells its items apart by title
    title: t('Loop table', {
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
