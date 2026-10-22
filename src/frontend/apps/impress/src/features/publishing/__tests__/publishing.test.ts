import { afterEach, describe, expect, it } from 'vitest';

import {
  appUrl,
  setWikiHostMode,
  slugify,
  wikiHostKind,
  wikiUrl,
} from '../utils';
import { flattenTree, pathTo, searchPages } from '../wiki/tree';

const tree = [
  {
    id: 'a',
    title: 'Getting started',
    children: [{ id: 'b', title: 'Café rules', children: [] }],
  },
  { id: 'c', title: 'Glossary', children: [] },
];

describe('publishing utils', () => {
  it('turns a title into a wiki address', () => {
    expect(slugify('  Team Handbook 2026! ')).toBe('team-handbook-2026');
    expect(slugify('Éléphant & Co')).toBe('elephant-co');
    expect(wikiUrl('handbook')).toBe('/wiki/handbook/');
    expect(wikiUrl('handbook', 'a')).toBe('/wiki/handbook/a/');
  });

  it('flattens the tree with the titles above each page', () => {
    expect(flattenTree(tree)).toEqual([
      { id: 'a', title: 'Getting started', trail: [] },
      { id: 'b', title: 'Café rules', trail: ['Getting started'] },
      { id: 'c', title: 'Glossary', trail: [] },
    ]);
  });

  it('finds the path down to a page', () => {
    expect(pathTo(tree, 'b')).toEqual(['a', 'b']);
    expect(pathTo(tree, 'zzz')).toEqual([]);
  });

  it('searches titles, ignoring case and accents', () => {
    const pages = flattenTree(tree);
    expect(searchPages(pages, 'cafe').map((page) => page.id)).toEqual(['b']);
    expect(searchPages(pages, 'G').map((page) => page.id)).toEqual(['a', 'c']);
    expect(searchPages(pages, '  ')).toEqual([]);
  });
});

describe('wiki addresses', () => {
  const config = {
    COLLABORATORS_APP_HOSTS: ['collaborators.community'],
    COLLABORATORS_WIKI_BASE_DOMAIN: 'collaborators.community',
  };

  afterEach(() => setWikiHostMode(null));

  it('tells the app from a workspace address and a wiki domain', () => {
    expect(wikiHostKind('collaborators.community', config)).toBeNull();
    expect(wikiHostKind('acme.collaborators.community', config)).toBe(
      'workspace',
    );
    // deeper names are not workspace addresses
    expect(wikiHostKind('a.b.collaborators.community', config)).toBe('domain');
    expect(wikiHostKind('help.example.com', config)).toBe('domain');
    expect(wikiHostKind('10.0.0.1', config)).toBeNull();
    expect(wikiHostKind('localhost', config)).toBeNull();
    // without the setting, every address is the app's
    expect(wikiHostKind('help.example.com', {})).toBeNull();
  });

  it('links the pages of a wiki as its address reads them', () => {
    expect(wikiUrl('handbook', 'p1')).toBe('/wiki/handbook/p1/');

    setWikiHostMode({ kind: 'workspace' });
    expect(wikiUrl('handbook')).toBe('/handbook/');
    expect(wikiUrl('handbook', 'p1')).toBe('/handbook/p1/');

    setWikiHostMode({ kind: 'domain', slug: 'handbook' });
    expect(wikiUrl('handbook', 'p1')).toBe('/p1/');
    // another wiki stays at its address on the app
    expect(wikiUrl('other', 'p1')).toBe('/wiki/other/p1/');
  });

  it('leads back to the app from a wiki address', () => {
    expect(appUrl('/page/p1/', config)).toBe('/page/p1/');
    setWikiHostMode({ kind: 'workspace' });
    expect(appUrl('/page/p1/', config)).toBe(
      `${window.location.protocol}//collaborators.community${
        window.location.port ? `:${window.location.port}` : ''
      }/page/p1/`,
    );
  });
});
