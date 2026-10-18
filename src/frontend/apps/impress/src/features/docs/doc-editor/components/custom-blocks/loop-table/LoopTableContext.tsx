import { createContext, useContext } from 'react';
import * as Y from 'yjs';

/**
 * The Y.Doc of the page being edited or read, where Loop tables keep their
 * data. Provided around the editor (live document) and the version reader
 * (a past version of the document).
 */
export const LoopTableDocContext = createContext<Y.Doc | null>(null);

export const useLoopTableDoc = () => useContext(LoopTableDocContext);
