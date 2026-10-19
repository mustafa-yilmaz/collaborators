import { Button } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Loading, StyledLink, Text } from '@/components';
import { Title } from '@/components/Title';
import { DocCoreEditor } from '@/docs/doc-editor/components/DocEditor';
import { useCollaboration } from '@/docs/doc-editor/hook/useCollaboration';
import {
  Doc,
  KEY_DOC,
  getEmojiAndTitle,
  useDoc,
  useDocStore,
  useTrans,
} from '@/docs/doc-management';
import LeftPanelIcon from '@/features/left-panel/assets/left-panel.svg';
import { useDate } from '@/hooks/useDate';
import { useResponsiveStore } from '@/stores';

import { WikiContext } from '../WikiContext';
import { Wiki, WikiNode, useWiki } from '../api';
import { WIKI_ACCENTS, wikiUrl } from '../utils';

import { flattenTree, pathTo, searchPages } from './tree';

const TreeItem = ({
  node,
  slug,
  currentId,
  openIds,
  depth,
}: {
  node: WikiNode;
  slug: string;
  currentId: string;
  openIds: string[];
  depth: number;
}) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const [isOpen, setIsOpen] = useState(openIds.includes(node.id));
  const isCurrent = node.id === currentId;
  const title = node.title || untitledDocument;

  useEffect(() => {
    if (openIds.includes(node.id)) {
      setIsOpen(true);
    }
  }, [openIds, node.id]);

  return (
    <li>
      <Box
        $direction="row"
        $align="center"
        $css={css`
          padding-left: ${depth * 14}px;
          border-radius: var(--c--globals--spacings--3xs);
          background: ${
            isCurrent
              ? 'var(--c--contextuals--background--semantic--contextual--primary)'
              : 'transparent'
          };
        `}
      >
        {node.children.length > 0 ? (
          <BoxButton
            aria-label={
              isOpen
                ? t('Collapse {{name}}', {
                    description: 'Wiki tree action',
                    name: title,
                  })
                : t('Expand {{name}}', {
                    description: 'Wiki tree action',
                    name: title,
                  })
            }
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            $padding="4xs"
          >
            <Icon
              iconName={isOpen ? 'expand_more' : 'chevron_right'}
              $size="18px"
              $variation="secondary"
            />
          </BoxButton>
        ) : (
          <Box $width="26px" />
        )}
        <StyledLink
          href={wikiUrl(slug, node.id)}
          aria-current={isCurrent ? 'page' : undefined}
          $css={css`
            flex: 1;
            min-width: 0;
            padding: 4px 6px 4px 0;
            color: inherit;
          `}
        >
          <Text $size="sm" $weight={isCurrent ? '700' : '400'} $ellipsis>
            {title}
          </Text>
        </StyledLink>
      </Box>
      {isOpen && node.children.length > 0 && (
        <TreeList
          nodes={node.children}
          slug={slug}
          currentId={currentId}
          openIds={openIds}
          depth={depth + 1}
        />
      )}
    </li>
  );
};

const TreeList = (props: {
  nodes: WikiNode[];
  slug: string;
  currentId: string;
  openIds: string[];
  depth: number;
}) => (
  <Box as="ul" $css="list-style: none; margin: 0; padding: 0;">
    {props.nodes.map((node) => (
      <TreeItem key={node.id} {...props} node={node} />
    ))}
  </Box>
);

const WikiNav = ({ wiki, currentId }: { wiki: Wiki; currentId: string }) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const [query, setQuery] = useState('');
  const pages = useMemo(() => flattenTree(wiki.tree), [wiki.tree]);
  const results = searchPages(pages, query);
  const openIds = useMemo(
    () => pathTo(wiki.tree, currentId),
    [wiki.tree, currentId],
  );

  return (
    <Box $gap="xs">
      <Box
        as="label"
        $direction="row"
        $align="center"
        $gap="2xs"
        $padding={{ horizontal: 'xs', vertical: '2xs' }}
        $css={css`
          border: 1px solid var(--c--contextuals--border--surface--primary);
          border-radius: var(--c--globals--spacings--xs);
        `}
      >
        <Icon iconName="search" $size="18px" $variation="secondary" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search this wiki', {
            description: 'Placeholder of the wiki search box',
          })}
          aria-label={t('Search this wiki', {
            description: 'Placeholder of the wiki search box',
          })}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            flex: 1,
            minWidth: 0,
            font: 'inherit',
          }}
        />
      </Box>
      {query.trim() ? (
        <Box as="ul" $css="list-style: none; margin: 0; padding: 0;">
          {results.length === 0 && (
            <Text $size="sm" $variation="secondary">
              {t('No page matches.', {
                description: 'Wiki search without results',
              })}
            </Text>
          )}
          {results.map((page) => (
            <li key={page.id}>
              <StyledLink
                href={wikiUrl(wiki.slug, page.id)}
                $css="display: block; padding: 4px 6px; color: inherit;"
              >
                <Text $size="sm" $weight="500" $ellipsis>
                  {page.title || untitledDocument}
                </Text>
                {page.trail.length > 0 && (
                  <Text $size="xs" $variation="secondary" $ellipsis>
                    {page.trail.join(' › ')}
                  </Text>
                )}
              </StyledLink>
            </li>
          ))}
        </Box>
      ) : (
        <nav
          aria-label={t('Pages of the wiki', {
            description: 'Accessible name of the wiki page tree',
          })}
        >
          <StyledLink
            href={wikiUrl(wiki.slug)}
            aria-current={currentId === wiki.id ? 'page' : undefined}
            $css="display: block; padding: 4px 6px; color: inherit;"
          >
            <Text
              $size="sm"
              $weight={currentId === wiki.id ? '700' : '500'}
              $ellipsis
            >
              {t('Home', { description: 'Home page of a wiki' })}
            </Text>
          </StyledLink>
          <TreeList
            nodes={wiki.tree}
            slug={wiki.slug}
            currentId={currentId}
            openIds={openIds}
            depth={0}
          />
        </nav>
      )}
    </Box>
  );
};

/** A wiki page, read-only, as its collaboration document holds it. */
const WikiDocReader = ({ doc }: { doc: Doc }) => {
  useCollaboration(doc.id, true);
  const { setCurrentDoc } = useDocStore();
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
    doc.title || untitledDocument,
  );

  useEffect(() => {
    setCurrentDoc(doc);
    return () => setCurrentDoc(undefined);
  }, [doc, setCurrentDoc]);

  return (
    <Box as="article" $gap="2xs">
      {/* lined up with the text, which the editor pads like this */}
      <Box $padding={{ horizontal: isDesktop ? '54px' : 'base' }} $gap="2xs">
        <Text as="h1" $size="h2" $margin="none" $weight="700">
          {emoji ? `${emoji} ` : ''}
          {titleWithoutEmoji}
        </Text>
        <Text $size="xs" $variation="secondary">
          {t('Updated {{date}}', {
            description: 'When a wiki page last changed',
            date: relativeDate(doc.updated_at),
          })}
        </Text>
      </Box>
      <Box className="--docs--editor-container --docs--doc-readonly">
        <DocCoreEditor doc={doc} readOnly />
      </Box>
    </Box>
  );
};

const WikiArticle = ({ docId }: { docId: string }) => {
  const { t } = useTranslation();
  const { data: doc, isError } = useDoc(
    { id: docId },
    { queryKey: [KEY_DOC, { id: docId }], retry: false },
  );
  if (isError) {
    return (
      <Text $variation="secondary">
        {t('This page cannot be shown.', {
          description: 'A wiki page that failed to load',
        })}
      </Text>
    );
  }
  if (!doc) {
    return <Loading />;
  }
  return <WikiDocReader key={doc.id} doc={doc} />;
};

const NotFound = () => {
  const { t } = useTranslation();
  return (
    <Box
      $height="100vh"
      $align="center"
      $justify="center"
      $gap="sm"
      $padding="md"
    >
      <Head>
        <meta name="robots" content="noindex" key="robots" />
      </Head>
      <Title headingLevel="h2" />
      <Text $size="md" $variation="secondary" $textAlign="center">
        {t('This wiki does not exist, or it is not published any more.', {
          description: 'Wiki not found',
        })}
      </Text>
      <StyledLink href="/">
        <Text $theme="brand" $variation="secondary">
          {t('Go to the home page', {
            description: 'Link from a missing wiki to the home page',
          })}
        </Text>
      </StyledLink>
    </Box>
  );
};

const NAV_OPEN_KEY = 'collaborators-wiki-nav-open';

const readNavOpen = () => {
  try {
    return localStorage.getItem(NAV_OPEN_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * A space published as a wiki, for anyone: its tree of pages and a search on
 * the side, the page being read in the middle, in the wiki's colour.
 */
export const WikiView = ({
  slug,
  pageId,
}: {
  slug: string;
  pageId?: string;
}) => {
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveStore();
  // The page tree is hidden until the reader shows it, and stays as they
  // left it from page to page
  const [isNavOpen, setNavOpen] = useState(readNavOpen);
  const setIsNavOpen = (isOpen: boolean) => {
    setNavOpen(isOpen);
    try {
      localStorage.setItem(NAV_OPEN_KEY, isOpen ? '1' : '0');
    } catch {
      // private browsing: kept for this page only
    }
  };
  const { data: wiki, isLoading } = useWiki(slug);
  const pageIds = useMemo(
    () =>
      new Set(
        wiki ? [wiki.id, ...flattenTree(wiki.tree).map((page) => page.id)] : [],
      ),
    [wiki],
  );

  // On a phone the tree covers the page: it closes once a page is chosen
  useEffect(() => {
    if (!isDesktop) {
      setNavOpen(false);
    }
  }, [pageId, isDesktop]);

  if (isLoading) {
    return <Loading $height="100vh" />;
  }
  if (!wiki) {
    return <NotFound />;
  }
  const currentId = pageId ?? wiki.id;
  const pageTitle = flattenTree(wiki.tree).find(
    (page) => page.id === currentId,
  )?.title;
  const accent = wiki.accent || WIKI_ACCENTS[0].value;
  const isInWiki = pageIds.has(currentId);
  const showNav = isNavOpen;

  return (
    <WikiContext.Provider value={{ slug: wiki.slug, pageIds }}>
      <Head>
        <title>{pageTitle ? `${pageTitle} - ${wiki.title}` : wiki.title}</title>
        <meta
          property="og:title"
          content={pageTitle ?? wiki.title}
          key="title"
        />
        <meta
          name="robots"
          content={wiki.allow_indexing ? 'index, follow' : 'noindex'}
          key="robots"
        />
      </Head>
      <Box
        $height="100vh"
        $css={css`
          border-top: 4px solid ${accent};
          --collaborators--wiki-accent: ${accent};
        `}
        className="--collaborators--wiki"
      >
        <Box
          as="header"
          $direction="row"
          $align="center"
          $justify="space-between"
          $gap="sm"
          $padding={{ horizontal: isDesktop ? 'md' : 'sm', vertical: 'xs' }}
          $css={css`
            border-bottom: 1px solid
              var(--c--contextuals--border--surface--primary);
          `}
        >
          <Box $direction="row" $align="center" $gap="xs" $css="min-width: 0;">
            <BoxButton
              aria-label={
                isNavOpen
                  ? t('Hide the pages of the wiki', {
                      description: 'Button hiding the page tree of a wiki',
                    })
                  : t('Show the pages of the wiki', {
                      description: 'Button showing the page tree of a wiki',
                    })
              }
              title={
                isNavOpen
                  ? t('Hide the pages of the wiki', {
                      description: 'Button hiding the page tree of a wiki',
                    })
                  : t('Show the pages of the wiki', {
                      description: 'Button showing the page tree of a wiki',
                    })
              }
              aria-expanded={isNavOpen}
              onClick={() => setIsNavOpen(!isNavOpen)}
              $padding="3xs"
              $css="flex-shrink: 0;"
            >
              <LeftPanelIcon width={24} height={24} aria-hidden="true" />
            </BoxButton>
            <StyledLink
              href={wikiUrl(wiki.slug)}
              $css="color: inherit; min-width: 0;"
            >
              <Text
                $size="lg"
                $weight="700"
                $ellipsis
                $css={`color: ${accent};`}
              >
                {wiki.title ||
                  t('Untitled space', {
                    description: 'Name of a space without title',
                  })}
              </Text>
            </StyledLink>
            {wiki.workspace && isDesktop && (
              <Text $size="sm" $variation="secondary" $ellipsis>
                {wiki.workspace}
              </Text>
            )}
          </Box>
          <Box $direction="row" $align="center" $gap="sm">
            {wiki.can_edit && (
              <StyledLink href={`/docs/${currentId}/`}>
                <Button
                  size="small"
                  variant="secondary"
                  icon={<Icon iconName="edit" $size="18px" $color="inherit" />}
                >
                  {t('Edit', { description: 'Open a wiki page in the editor' })}
                </Button>
              </StyledLink>
            )}
            <StyledLink href="/" aria-label="Collaborators">
              <Title headingLevel="h2" $size="0.95rem" />
            </StyledLink>
          </Box>
        </Box>
        <Box $direction="row" $flex={1} $css="min-height: 0;">
          {showNav && (
            <Box
              as="aside"
              $width={isDesktop ? '280px' : '100%'}
              $padding="sm"
              $css={css`
                flex-shrink: 0;
                overflow-y: auto;
                border-right: 1px solid
                  var(--c--contextuals--border--surface--primary);
                background: var(--c--contextuals--background--surface--primary);
                ${isDesktop ? '' : 'position: absolute; inset: 60px 0 0 0; z-index: 5;'}
              `}
            >
              <WikiNav wiki={wiki} currentId={currentId} />
            </Box>
          )}
          <Box
            as="main"
            $flex={1}
            $css="overflow-y: auto; min-width: 0;"
            id="wiki-content"
          >
            <Box
              $maxWidth="868px"
              $width="100%"
              $margin={{ horizontal: 'auto' }}
              $padding={{ vertical: 'md' }}
              $gap="lg"
            >
              {isInWiki ? (
                <WikiArticle docId={currentId} />
              ) : (
                <Text $variation="secondary">
                  {t('This page is not part of the wiki.', {
                    description: 'A page address outside of the wiki',
                  })}
                </Text>
              )}
              <Box
                as="footer"
                $direction="row"
                $align="center"
                $justify="center"
                $gap="2xs"
                $padding={{ top: 'lg' }}
                $css={css`
                  border-top: 1px solid
                    var(--c--contextuals--border--surface--primary);
                `}
              >
                <Text $size="xs" $variation="secondary">
                  {t('Published with', {
                    description: 'Footer of a public wiki, before the logo',
                  })}
                </Text>
                <StyledLink href="/">
                  <Title headingLevel="h3" $size="0.8rem" />
                </StyledLink>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </WikiContext.Provider>
  );
};
