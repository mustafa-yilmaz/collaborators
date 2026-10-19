import { createContext, useContext } from 'react';

/** Set while a page is read inside a public wiki: links stay in the wiki. */
export const WikiContext = createContext<{
  slug: string;
  pageIds: Set<string>;
} | null>(null);

export const useWikiContext = () => useContext(WikiContext);
