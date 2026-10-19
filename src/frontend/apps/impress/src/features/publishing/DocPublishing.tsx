import { Button, Input, Switch } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { Doc } from '@/docs/doc-management';
import { useClipboard } from '@/hooks';

import {
  Publication,
  usePublication,
  useUpdatePublication,
  useWikiMutations,
} from './api';
import { WIKI_ACCENTS, slugify, wikiUrl } from './utils';

const ErrorText = ({ children }: { children?: string }) =>
  children ? (
    <Text $size="xs" $theme="error" role="alert">
      {children}
    </Text>
  ) : null;

const WikiSettings = ({
  doc,
  publication,
}: {
  doc: Doc;
  publication: Publication;
}) => {
  const { t } = useTranslation();
  const copyToClipboard = useClipboard();
  const wiki = publication.wiki;
  const [slug, setSlug] = useState(wiki?.slug ?? slugify(doc.title ?? ''));
  const [accent, setAccent] = useState(wiki?.accent || WIKI_ACCENTS[0].value);
  const [allowIndexing, setAllowIndexing] = useState(
    wiki ? publication.allow_indexing : false,
  );
  const { publish, unpublish } = useWikiMutations(doc.id);
  const address = `${typeof window !== 'undefined' ? window.location.origin : ''}${wikiUrl(slugify(slug) || '…')}`;
  const isChanged =
    !wiki ||
    slugify(slug) !== wiki.slug ||
    accent !== wiki.accent ||
    allowIndexing !== publication.allow_indexing;

  return (
    <Box $gap="xs" className="--collaborators--wiki-settings">
      <Text $size="sm" $variation="secondary">
        {wiki
          ? t('This space is published as a public wiki. Anyone can read it.', {
              description: 'Share dialog, space published as a wiki',
            })
          : t(
              'Publish this space as a public wiki: anyone can read its pages, with their tree and a search, without signing in. Pages kept private stay out.',
              { description: 'Share dialog, explanation of wikis' },
            )}
      </Text>
      {wiki && (
        <Box
          $direction="row"
          $align="center"
          $gap="xs"
          $padding={{ horizontal: 'xs', vertical: '3xs' }}
          $css={css`
            border-radius: var(--c--globals--spacings--3xs);
            background: var(
              --c--contextuals--background--semantic--contextual--primary
            );
          `}
        >
          <Icon iconName="public" $size="18px" $variation="secondary" />
          <StyledLink
            href={wikiUrl(wiki.slug)}
            target="_blank"
            $css="flex: 1; min-width: 0;"
          >
            <Text $size="sm" $weight="500" $ellipsis>
              {address}
            </Text>
          </StyledLink>
          <BoxButton
            aria-label={t('Copy the wiki address', {
              description: 'Button copying the address of a wiki',
            })}
            title={t('Copy the wiki address', {
              description: 'Button copying the address of a wiki',
            })}
            onClick={() =>
              copyToClipboard(
                address,
                t('Link Copied !', {
                  description:
                    'Toast confirming a link was copied to the clipboard',
                }),
                t('Failed to copy link', {
                  description: 'Toast shown when copying a link failed',
                }),
              )
            }
            $padding="3xs"
          >
            <Icon iconName="content_copy" $size="18px" $variation="secondary" />
          </BoxButton>
        </Box>
      )}
      <Input
        fullWidth
        label={t('Wiki address', {
          description: 'Label of the address field of a wiki',
        })}
        text={address}
        value={slug}
        disabled={!publication.can_publish}
        onChange={(event) => setSlug(event.target.value)}
      />
      <Box $direction="row" $align="center" $gap="xs" $wrap="wrap">
        <Text $size="sm">
          {t('Colour', { description: 'Label of the accent colour of a wiki' })}
        </Text>
        {WIKI_ACCENTS.map((colour) => (
          <BoxButton
            key={colour.value}
            aria-label={colour.name}
            title={colour.name}
            aria-pressed={accent === colour.value}
            disabled={!publication.can_publish}
            onClick={() => setAccent(colour.value)}
            $css={css`
              width: 22px;
              height: 22px;
              border-radius: 50%;
              background: ${colour.value};
              box-shadow: ${
                accent === colour.value
                  ? `0 0 0 2px var(--c--contextuals--background--surface--primary), 0 0 0 4px ${colour.value}`
                  : 'none'
              };
            `}
          />
        ))}
      </Box>
      <Switch
        labelSide="right"
        label={t('Let search engines find this wiki', {
          description: 'Switch allowing search engines to index a wiki',
        })}
        checked={allowIndexing}
        disabled={!publication.can_publish}
        onChange={() => setAllowIndexing(!allowIndexing)}
      />
      <ErrorText>{publish.error?.cause?.[0]}</ErrorText>
      {publication.can_publish && (
        <Box $direction="row" $gap="xs" $justify="flex-end">
          {wiki && (
            <Button
              variant="secondary"
              color="error"
              size="small"
              onClick={() => unpublish.mutate()}
            >
              {t('Unpublish', { description: 'Button taking a wiki down' })}
            </Button>
          )}
          <Button
            size="small"
            disabled={!slugify(slug) || !isChanged || publish.isPending}
            onClick={() =>
              publish.mutate({
                slug: slugify(slug),
                accent,
                allow_indexing: allowIndexing,
              })
            }
          >
            {wiki
              ? t('Save changes', { description: 'Button saving a wiki' })
              : t('Publish as wiki', {
                  description: 'Button publishing a space as a wiki',
                })}
          </Button>
        </Box>
      )}
    </Box>
  );
};

/**
 * The share dialog's "Publish to the web" settings: a space is published as
 * a wiki; a public page can let search engines find it; a sub-page can be
 * kept private, out of public links and wikis.
 */
export const DocPublishing = ({ doc }: { doc: Doc }) => {
  const { t } = useTranslation();
  const { data: publication } = usePublication(doc.id);
  const update = useUpdatePublication(doc.id);
  if (!publication?.can_configure) {
    return null;
  }
  const isSpace = doc.kind === 'space';
  const isSubPage = doc.depth > 1;

  return (
    <Box
      $padding={{ horizontal: 'base' }}
      $gap="sm"
      className="--collaborators--doc-publishing"
    >
      <Text as="h2" $weight="700" $size="sm" $margin="none">
        {t('Publish to the web', {
          description: 'Heading of the publishing settings in the share dialog',
        })}
      </Text>
      {isSpace && <WikiSettings doc={doc} publication={publication} />}
      {!isSpace && publication.is_public && (
        <Switch
          labelSide="right"
          label={t('Let search engines find this page', {
            description: 'Switch allowing search engines to index a page',
          })}
          checked={publication.allow_indexing}
          disabled={!publication.can_publish}
          onChange={() =>
            update.mutate({ allow_indexing: !publication.allow_indexing })
          }
        />
      )}
      {!isSpace && !publication.is_public && !isSubPage && (
        <Text $size="sm" $variation="secondary">
          {t(
            'Set the link above to "Public" to publish this page: anyone with the link can read it, and its sub-pages.',
            { description: 'Share dialog, how to publish a page' },
          )}
        </Text>
      )}
      {isSubPage && (
        <Box $gap="3xs">
          <Switch
            labelSide="right"
            label={t('Keep private', {
              description: 'Switch keeping a sub-page out of public sharing',
            })}
            checked={publication.keep_private}
            onChange={() =>
              update.mutate({ keep_private: !publication.keep_private })
            }
          />
          <Text $size="xs" $variation="secondary">
            {t(
              'Leaves this page and its sub-pages out of public links and wikis, even when the pages above are public. People invited keep their access.',
              { description: 'Explanation of the Keep private switch' },
            )}
          </Text>
        </Box>
      )}
      {!publication.can_publish && (
        <Text $size="xs" $variation="secondary">
          {t('Your workspace only lets its administrators publish.', {
            description: 'Shown when the publishing policy forbids publishing',
          })}
        </Text>
      )}
      <ErrorText>{update.error?.cause?.[0]}</ErrorText>
    </Box>
  );
};
