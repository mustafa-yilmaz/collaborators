import { TableHandlesExtension } from '@blocknote/core/extensions';
import { useEffect } from 'react';

import type { DocsBlockNoteEditor } from '../../../types';

/**
 * Keeps BlockNote's simple-table handles away from Loop tables. Their mouse
 * handler takes any <td> in the editor for a cell of a simple table and reads
 * the block's `content.rows`, which a Loop table block doesn't have, so every
 * mouse move over a Loop table cell threw. Frozen handles skip that handler,
 * so they stay frozen while the pointer is over a Loop table.
 */
export const useLoopTableHandlesGuard = (editor: DocsBlockNoteEditor) => {
  useEffect(() => {
    const tableHandles = editor.getExtension(TableHandlesExtension);
    if (!tableHandles) {
      return;
    }
    let frozen = false;

    // `mouseover` fires before the `mousemove` and `mouseup` that the
    // handles listen to, each time the pointer reaches another element
    const onMouseOver = (event: MouseEvent) => {
      const overLoopTable =
        event.target instanceof Element &&
        !!event.target.closest('.loop-table');
      if (overLoopTable && !frozen) {
        tableHandles.freezeHandles();
        frozen = true;
      } else if (!overLoopTable && frozen) {
        tableHandles.unfreezeHandles();
        frozen = false;
      }
    };

    document.addEventListener('mouseover', onMouseOver, true);
    return () => {
      document.removeEventListener('mouseover', onMouseOver, true);
      if (frozen) {
        tableHandles.unfreezeHandles();
      }
    };
  }, [editor]);
};
