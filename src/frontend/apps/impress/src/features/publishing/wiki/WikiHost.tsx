import Head from 'next/head';
import { useRouter } from 'next/router';
import { PropsWithChildren, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Loading, StyledLink, Text } from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';

import { WikiHost as WikiHostData, useWikiHost } from '../api';
import { appUrl, setWikiHostMode, wikiHostKind, wikiUrl } from '../utils';

import { LazyWikiView } from './LazyWikiView';

/** The wikis published by a workspace, at its own address. */
const WorkspaceWikis = ({
  host,
}: {
  host: Extract<WikiHostData, { kind: 'workspace' }>;
}) => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  // Collaborators: a hidden workspace's address shows its wikis, unnamed
  const heading =
    host.workspace.name ??
    t('Wikis', { description: 'Heading of a workspace address without name' });
  return (
    <Box
      $minHeight="100vh"
      $align="center"
      $padding={{ horizontal: 'md', vertical: '4xl' }}
      $gap="md"
    >
      <Head>
        <title>{heading}</title>
      </Head>
      <Text as="h1" $size="h3" $weight="700" $margin="none">
        {heading}
      </Text>
      {host.wikis.length === 0 ? (
        <Text $variation="secondary">
          {t('No wiki is published here yet.', {
            description: 'Workspace address without any published wiki',
          })}
        </Text>
      ) : (
        <Box
          as="ul"
          $gap="xs"
          $width="100%"
          $maxWidth="520px"
          $css="list-style: none; margin: 0; padding: 0;"
        >
          {host.wikis.map((wiki) => (
            <li key={wiki.slug}>
              <StyledLink
                href={wikiUrl(wiki.slug)}
                $css={css`
                  display: block;
                  padding: 14px 16px;
                  border: 1px solid
                    var(--c--contextuals--border--surface--primary);
                  border-radius: var(--c--globals--spacings--xs);
                  color: inherit;
                  &:hover {
                    background: var(
                      --c--contextuals--background--semantic--contextual--primary
                    );
                  }
                `}
              >
                <Text $weight="600">{wiki.title}</Text>
              </StyledLink>
            </li>
          ))}
        </Box>
      )}
      <StyledLink href={appUrl('/', config)}>
        <Title headingLevel="h2" $size="0.9rem" />
      </StyledLink>
    </Box>
  );
};

const NotPublished = () => {
  const { t } = useTranslation();
  return (
    <Box $height="100vh" $align="center" $justify="center" $gap="sm">
      <Head>
        <meta name="robots" content="noindex" key="robots" />
      </Head>
      <Title headingLevel="h2" />
      <Text $variation="secondary" $textAlign="center">
        {t('Nothing is published at this address.', {
          description: 'A wiki address that leads nowhere',
        })}
      </Text>
    </Box>
  );
};

const WikiAtHost = ({
  hostname,
  kind,
  app,
}: {
  hostname: string;
  kind: 'workspace' | 'domain';
  app: ReactNode;
}) => {
  const { asPath } = useRouter();
  const { data: host, isLoading } = useWikiHost(hostname);
  if (isLoading) {
    return <Loading $height="100vh" />;
  }
  if (!host) {
    // An address that isn't a wiki's own domain is one of the app's
    return kind === 'domain' ? <>{app}</> : <NotPublished />;
  }
  const parts = asPath.split(/[?#]/)[0].split('/').filter(Boolean);
  if (host.kind === 'domain') {
    setWikiHostMode({ kind: 'domain', slug: host.slug });
    return <LazyWikiView slug={host.slug} pageId={parts[0]} />;
  }
  setWikiHostMode({ kind: 'workspace' });
  if (!parts.length) {
    return <WorkspaceWikis host={host} />;
  }
  // Only the workspace's own wikis are read at its address
  if (!host.wikis.some((wiki) => wiki.slug === parts[0])) {
    return <NotPublished />;
  }
  return <LazyWikiView slug={parts[0]} pageId={parts[1]} />;
};

/**
 * Wikis have addresses of their own: a workspace's
 * (<workspace>.<base domain>/<wiki>/<page>) and a wiki's own domain
 * (<domain>/<page>). At such an address, the wiki shows instead of the app,
 * for anyone, signed in or not.
 */
export const WikiHostGate = ({ children }: PropsWithChildren) => {
  const { data: config } = useConfig();
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const kind = config && hostname ? wikiHostKind(hostname, config) : null;
  if (!kind) {
    return <>{children}</>;
  }
  return <WikiAtHost hostname={hostname} kind={kind} app={children} />;
};
