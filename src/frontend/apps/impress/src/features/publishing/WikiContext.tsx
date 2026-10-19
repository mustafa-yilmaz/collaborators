import { createContext, useContext } from 'react';

/**
 * Set while a page is read inside a public wiki: links stay in the wiki, and
 * name its pages by the titles it publishes (a fixed version's pages can't
 * be read one by one).
 */
export const WikiContext = createContext<{
  slug: string;
  pageIds: Set<string>;
  titles?: Map<string, string>;
} | null>(null);

export const useWikiContext = () => useContext(WikiContext);
