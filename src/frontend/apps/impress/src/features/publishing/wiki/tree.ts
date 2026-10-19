import { WikiNode } from '../api';

export interface FlatWikiPage {
  id: string;
  title: string;
  /** Titles of the pages above it, from the top */
  trail: string[];
}

/** Every page of a wiki tree, with the titles above it. */
export const flattenTree = (
  nodes: WikiNode[],
  trail: string[] = [],
): FlatWikiPage[] =>
  nodes.flatMap((node) => [
    { id: node.id, title: node.title, trail },
    ...flattenTree(node.children, [...trail, node.title]),
  ]);

/** The ids of the pages from the top of the tree down to `id`, or []. */
export const pathTo = (nodes: WikiNode[], id: string): string[] => {
  for (const node of nodes) {
    if (node.id === id) {
      return [node.id];
    }
    const below = pathTo(node.children, id);
    if (below.length) {
      return [node.id, ...below];
    }
  }
  return [];
};

const fold = (text: string) =>
  text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pages whose title contains every word of the query. */
export const searchPages = (pages: FlatWikiPage[], query: string) => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [];
  }
  return pages.filter((page) =>
    words.every((word) => fold(page.title).includes(word)),
  );
};
