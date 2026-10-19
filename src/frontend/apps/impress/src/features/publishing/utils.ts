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

/**
 * How the current address shows wikis: the app's own addresses show them at
 * /wiki/<slug>/; a workspace's address (<workspace>.<base domain>) at
 * /<slug>/; a wiki's own domain at /.
 */
type WikiHostMode = { kind: 'workspace' } | { kind: 'domain'; slug: string };
let hostMode: WikiHostMode | null = null;

export const setWikiHostMode = (mode: WikiHostMode | null) => {
  hostMode = mode;
};

export const isOnWikiHost = () => hostMode !== null;

export const wikiUrl = (slug: string, pageId?: string) => {
  const page = pageId ? `${pageId}/` : '';
  if (hostMode?.kind === 'workspace') {
    return `/${slug}/${page}`;
  }
  if (hostMode?.kind === 'domain' && hostMode.slug === slug) {
    return `/${page}`;
  }
  return `/wiki/${slug}/${page}`;
};

interface HostConfig {
  COLLABORATORS_APP_HOSTS?: string[];
  COLLABORATORS_WIKI_BASE_DOMAIN?: string;
}

/**
 * What an address is: one of the app's own (null), a workspace's wiki
 * address, or possibly a wiki's own domain (the server tells).
 */
export const wikiHostKind = (
  hostname: string,
  config: HostConfig,
): 'workspace' | 'domain' | null => {
  const host = hostname.toLowerCase();
  const appHosts = config.COLLABORATORS_APP_HOSTS ?? [];
  const base = config.COLLABORATORS_WIKI_BASE_DOMAIN;
  if (!appHosts.length || appHosts.includes(host)) {
    return null;
  }
  if (
    base &&
    host.endsWith(`.${base}`) &&
    host.split('.').length === base.split('.').length + 1
  ) {
    return 'workspace';
  }
  // An IP address, or a name without dots, is never a wiki's own domain
  if (/^[\d.]+$/.test(host) || !host.includes('.')) {
    return null;
  }
  return 'domain';
};

/** An address of the app, from wherever a wiki is read. */
export const appUrl = (path: string, config?: HostConfig) => {
  const appHost = config?.COLLABORATORS_APP_HOSTS?.[0];
  if (!hostMode || !appHost || typeof window === 'undefined') {
    return path;
  }
  const { protocol, port } = window.location;
  return `${protocol}//${appHost}${port ? `:${port}` : ''}${path}`;
};

/** The addresses a published wiki can be read at. */
export const wikiAddresses = (
  wiki: { slug: string; domain: string | null; workspace_slug: string | null },
  config?: HostConfig,
) => {
  if (typeof window === 'undefined') {
    return [];
  }
  const { protocol, port, origin } = window.location;
  const withPort = port ? `:${port}` : '';
  const base = config?.COLLABORATORS_WIKI_BASE_DOMAIN;
  return [
    `${origin}/wiki/${wiki.slug}/`,
    ...(base && wiki.workspace_slug
      ? [`${protocol}//${wiki.workspace_slug}.${base}${withPort}/${wiki.slug}/`]
      : []),
    ...(wiki.domain ? [`https://${wiki.domain}/`] : []),
  ];
};
