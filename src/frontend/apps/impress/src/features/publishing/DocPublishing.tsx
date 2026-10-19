import { Button, Input, Switch } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { useUploadImage } from '@/docs/doc-editor/hook/useUploadImage';
import { Doc } from '@/docs/doc-management';
import { useClipboard } from '@/hooks';
import { useDate } from '@/hooks/useDate';

import {
  Publication,
  usePublication,
  useUpdatePublication,
  useWikiMutations,
} from './api';
import { WIKI_ACCENTS, slugify, wikiAddresses, wikiUrl } from './utils';

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
  const [logo, setLogo] = useState(wiki?.logo ?? '');
  const [domain, setDomain] = useState(wiki?.domain ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const uploadImage = useUploadImage(doc.id);
  const { data: config } = useConfig();
  const { formatDate } = useDate();
  const { publish, unpublish, release, goLive } = useWikiMutations(doc.id);
  const address = `${typeof window !== 'undefined' ? window.location.origin : ''}${wikiUrl(slugify(slug) || '…')}`;
  const addresses = wiki ? wikiAddresses(wiki, config) : [];
  const isChanged =
    !wiki ||
    slugify(slug) !== wiki.slug ||
    accent !== wiki.accent ||
    allowIndexing !== publication.allow_indexing ||
    logo !== wiki.logo ||
    domain.trim() !== (wiki.domain ?? '');
  const copy = (text: string) =>
    copyToClipboard(
      text,
      t('Link Copied !', {
        description: 'Toast confirming a link was copied to the clipboard',
      }),
      t('Failed to copy link', {
        description: 'Toast shown when copying a link failed',
      }),
    );

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
      {addresses.map((url) => (
        <Box
          key={url}
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
          <StyledLink href={url} target="_blank" $css="flex: 1; min-width: 0;">
            <Text $size="sm" $weight="500" $ellipsis>
              {url}
            </Text>
          </StyledLink>
          <BoxButton
            aria-label={t('Copy the wiki address', {
              description: 'Button copying the address of a wiki',
            })}
            title={t('Copy the wiki address', {
              description: 'Button copying the address of a wiki',
            })}
            onClick={() => copy(url)}
            $padding="3xs"
          >
            <Icon iconName="content_copy" $size="18px" $variation="secondary" />
          </BoxButton>
        </Box>
      ))}
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
      <Box $direction="row" $align="center" $gap="xs" $wrap="wrap">
        <Text $size="sm">
          {t('Logo', { description: 'Label of the logo of a wiki' })}
        </Text>
        {logo && (
          <img
            src={logo}
            alt=""
            style={{ height: 28, maxWidth: 120, objectFit: 'contain' }}
          />
        )}
        {publication.can_publish && (
          <Box
            as="label"
            $direction="row"
            $align="center"
            $gap="3xs"
            $css="cursor: pointer;"
          >
            <Icon iconName="upload" $size="18px" $variation="secondary" />
            <Text $size="sm" $theme="brand">
              {isUploading
                ? t('Uploading…', { description: 'Image being uploaded' })
                : logo
                  ? t('Change', { description: 'Changes the logo of a wiki' })
                  : t('Upload an image', {
                      description: 'Uploads the logo of a wiki',
                    })}
            </Text>
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }
                setIsUploading(true);
                uploadImage(file)
                  .then((url) => setLogo(url))
                  .catch(() => undefined)
                  .finally(() => setIsUploading(false));
              }}
            />
          </Box>
        )}
        {logo && publication.can_publish && (
          <BoxButton onClick={() => setLogo('')} $padding="3xs">
            <Text $size="sm" $variation="secondary">
              {t('Remove', { description: 'Removes the logo of a wiki' })}
            </Text>
          </BoxButton>
        )}
      </Box>
      <Input
        fullWidth
        label={t('Its own domain (optional)', {
          description: 'Label of the own domain field of a wiki',
        })}
        text={
          config?.COLLABORATORS_WIKI_DOMAIN_TARGET
            ? t(
                'For example help.example.com. Point a CNAME record of this domain at {{target}}.',
                {
                  description: 'Help of the own domain field of a wiki',
                  target: config.COLLABORATORS_WIKI_DOMAIN_TARGET,
                },
              )
            : undefined
        }
        value={domain}
        disabled={!publication.can_publish}
        onChange={(event) => setDomain(event.target.value)}
      />
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
                logo,
                domain: domain.trim(),
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
      {wiki && publication.can_publish && (
        <Box
          $gap="2xs"
          $padding={{ top: 'xs' }}
          $css={css`
            border-top: 1px solid
              var(--c--contextuals--border--surface--primary);
          `}
        >
          <Text $size="sm" $weight="600">
            {t('What readers see', {
              description: 'Heading of the live or fixed version of a wiki',
            })}
          </Text>
          <Text $size="sm" $variation="secondary">
            {wiki.released_at
              ? t(
                  'The version published {{date}}. Changes made since stay unpublished until you publish again; the pages themselves are not public meanwhile.',
                  {
                    description: 'A wiki showing a fixed version',
                    date: formatDate(wiki.released_at),
                  },
                )
              : t(
                  'The pages as they are, changes included as they are made. You can publish a fixed version instead: readers then see the pages as they are now, until you publish again.',
                  { description: 'A wiki showing its live pages' },
                )}
          </Text>
          <ErrorText>
            {release.error?.cause?.[0] ?? goLive.error?.cause?.[0]}
          </ErrorText>
          <Box $direction="row" $gap="xs" $justify="flex-end" $wrap="wrap">
            {wiki.released_at && (
              <Button
                size="small"
                variant="secondary"
                disabled={goLive.isPending}
                onClick={() => goLive.mutate()}
              >
                {t('Show the live pages', {
                  description: 'Button going back from a fixed version',
                })}
              </Button>
            )}
            <Button
              size="small"
              variant="secondary"
              disabled={release.isPending}
              onClick={() => release.mutate()}
            >
              {wiki.released_at
                ? t('Publish the current version', {
                    description: 'Button publishing a new fixed version',
                  })
                : t('Publish a fixed version', {
                    description: 'Button publishing a fixed version of a wiki',
                  })}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * The share dialog's "Publish to the web" settings: a space is published as
 * a wiki; a public page can let search engines find it. (Keeping a sub-page
 * private is one of the "Who can see this?" choices.)
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
            'Choose "Public on the internet" above to publish this page: anyone with the link can read it, and its sub-pages.',
            { description: 'Share dialog, how to publish a page' },
          )}
        </Text>
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
