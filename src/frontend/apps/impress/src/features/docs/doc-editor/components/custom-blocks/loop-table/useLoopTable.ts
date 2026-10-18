import { useEffect, useState } from 'react';
import * as Y from 'yjs';

import { TableSnapshot, getTable, getTablesMap, readTable } from './model';

/**
 * Follow a table of the page's Y.Doc: returns its Y.Map, for writing, and
 * a plain snapshot, refreshed on every local or remote change, for display.
 */
export const useLoopTable = (ydoc: Y.Doc | null, tableId: string) => {
  const [table, setTable] = useState<Y.Map<unknown> | undefined>(() =>
    ydoc && tableId ? getTable(ydoc, tableId) : undefined,
  );
  const [snapshot, setSnapshot] = useState<TableSnapshot | undefined>(() =>
    table ? readTable(table) : undefined,
  );

  // The table may arrive after the block, e.g. while the page syncs
  useEffect(() => {
    if (!ydoc || !tableId) {
      return;
    }
    const tables = getTablesMap(ydoc);
    const update = () => setTable(tables.get(tableId));
    update();
    tables.observe(update);
    return () => tables.unobserve(update);
  }, [ydoc, tableId]);

  useEffect(() => {
    if (!table) {
      setSnapshot(undefined);
      return;
    }
    const update = () => setSnapshot(readTable(table));
    update();
    table.observeDeep(update);
    return () => table.unobserveDeep(update);
  }, [table]);

  return { table, snapshot };
};
