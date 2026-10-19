/** Accent colours a wiki can take, the first being the platform's. */
export const WIKI_ACCENTS = [
  { value: '#3e3ba0', name: 'Indigo' },
  { value: '#2f6fde', name: 'Blue' },
  { value: '#0b7a75', name: 'Teal' },
  { value: '#1f7a3a', name: 'Green' },
  { value: '#b4441c', name: 'Rust' },
  { value: '#8a2c8f', name: 'Plum' },
];

/** A wiki address made of the words of a title: "Team Handbook" → "team-handbook". */
export const slugify = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

export const wikiUrl = (slug: string, pageId?: string) =>
  `/wiki/${slug}/${pageId ? `${pageId}/` : ''}`;
