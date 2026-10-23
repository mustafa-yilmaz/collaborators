import { useCallback, useSyncExternalStore } from 'react';
import * as Y from 'yjs';

import { useProviderStore } from '@/docs/doc-management/stores/useProviderStore';

/**
 * Collaborators: settings of a page kept with its content, so they follow
 * it everywhere at once and change only for those who may edit it.
 */
export const PAGE_SETTINGS_KEY = 'collaborators-page';
const TABLE_OF_CONTENTS = 'tableOfContents';

/** Whether a page shows a table of contents: off unless chosen. */
export const hasTableOfContents = (ydoc: Y.Doc) =>
  ydoc.getMap(PAGE_SETTINGS_KEY).get(TABLE_OF_CONTENTS) === true;

export const setTableOfContents = (ydoc: Y.Doc, isOn: boolean) => {
  const settings = ydoc.getMap(PAGE_SETTINGS_KEY);
  if (isOn) {
    settings.set(TABLE_OF_CONTENTS, true);
  } else {
    settings.delete(TABLE_OF_CONTENTS);
  }
};

/**
 * Collaborators: the table of contents of the page open (`docId`) is
 * optional, and off unless an editor turns it on from the page's menu.
 */
export const usePageTableOfContents = (docId?: string) => {
  const provider = useProviderStore((state) => state.provider);
  const ydoc = docId && provider?.roomname === docId ? provider.doc : null;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!ydoc) {
        return () => {};
      }
      const settings = ydoc.getMap(PAGE_SETTINGS_KEY);
      settings.observe(onChange);
      return () => settings.unobserve(onChange);
    },
    [ydoc],
  );
  const isOn = useSyncExternalStore(
    subscribe,
    () => !!ydoc && hasTableOfContents(ydoc),
    () => false,
  );
  const setIsOn = useCallback(
    (value: boolean) => ydoc && setTableOfContents(ydoc, value),
    [ydoc],
  );

  return { isOn, setIsOn, isAvailable: !!ydoc };
};
