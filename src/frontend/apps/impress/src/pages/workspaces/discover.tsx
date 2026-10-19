import { Button, Input } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  Icon,
  Loading,
  SCREEN_MAX_WIDTH,
  StyledLink,
  Text,
} from '@/components';
import { Title } from '@/components/Title';
import { gotoLogin, useAuth } from '@/features/auth';
import {
  DirectoryWorkspace,
  useAskToJoin,
  useWorkspaceDirectory,
} from '@/features/workspaces/api';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { NextPageWithLayout } from '@/types/next';

const WorkspaceCard = ({ workspace }: { workspace: DirectoryWorkspace }) => {
  const { t } = useTranslation();
  const { push } = useRouter();
  const { authenticated } = useAuth();
  const ask = useAskToJoin();
  const { setCurrentWorkspaceId } = useWorkspaceStore();

  let action;
  if (workspace.is_member) {
    action = (
      <Button
        size="small"
        variant="secondary"
        onClick={() => {
          setCurrentWorkspaceId(workspace.id);
          void push('/');
        }}
      >
        {t('Open', { description: 'Button opening a workspace' })}
      </Button>
    );
  } else if (workspace.request_status === 'pending') {
    action = (
      <Text $size="sm" $variation="secondary" role="status">
        {t('Request sent', {
          description: 'A request to join waits for an admin',
        })}
      </Text>
    );
  } else if (workspace.request_status === 'declined') {
    action = (
      <Text $size="sm" $variation="secondary">
        {t('Request declined', {
          description: 'An admin declined the request to join',
        })}
      </Text>
    );
  } else if (authenticated) {
    action = (
      <Button
        size="small"
        disabled={ask.isPending}
        onClick={() => ask.mutate({ workspaceId: workspace.id })}
      >
        {t('Ask to join', { description: 'Button asking to join a workspace' })}
      </Button>
    );
  } else {
    action = (
      <Button size="small" variant="secondary" onClick={() => gotoLogin()}>
        {t('Sign in to ask to join', {
          description: 'Button for signed-out visitors of the directory',
        })}
      </Button>
    );
  }

  return (
    <Box
      as="li"
      $gap="xs"
      $padding="sm"
      data-testid={`directory-${workspace.slug}`}
      $css={css`
        list-style: none;
        border: 1px solid var(--c--contextuals--border--surface--primary);
        border-radius: var(--c--globals--spacings--xs);
      `}
    >
      <Box $direction="row" $align="center" $justify="space-between" $gap="sm">
        <Box $direction="row" $align="center" $gap="xs" $css="min-width: 0;">
          <Icon iconName="workspaces" $size="22px" $variation="secondary" />
          <Text $weight="600" $ellipsis>
            {workspace.name}
          </Text>
          <Text $size="xs" $variation="secondary">
            {workspace.member_count === 1
              ? t('1 member', { description: 'Number of members' })
              : t('{{count}} members', {
                  description: 'Number of members',
                  count: workspace.member_count,
                })}
          </Text>
        </Box>
        {action}
      </Box>
      {workspace.description && (
        <Text $size="sm" $variation="secondary">
          {workspace.description}
        </Text>
      )}
      {workspace.public_spaces.length > 0 && (
        <Box $direction="row" $gap="xs" $css="flex-wrap: wrap;">
          {workspace.public_spaces.map((space) => (
            <StyledLink key={space.id} href={`/docs/${space.id}/`}>
              <Box $direction="row" $align="center" $gap="4xs">
                <Icon iconName="folder" $size="16px" $variation="secondary" />
                <Text $size="sm" $theme="brand">
                  {space.title}
                </Text>
              </Box>
            </StyledLink>
          ))}
        </Box>
      )}
    </Box>
  );
};

/**
 * /workspaces/discover/: the workspaces one can find, to ask to join them.
 * Public workspaces show even signed out; those open to everyone on
 * Collaborators once signed in.
 */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { authenticated } = useAuth();
  const { data: workspaces = [], isLoading } = useWorkspaceDirectory(query);
  const title = t('Discover workspaces', {
    description: 'Heading of the directory of workspaces',
  });

  return (
    <>
      <Head>
        <title>{`${title} - Collaborators`}</title>
      </Head>
      <Box
        as="main"
        $width="100%"
        $maxWidth={SCREEN_MAX_WIDTH}
        $margin={{ horizontal: 'auto' }}
        $padding={{ horizontal: 'md', vertical: 'lg' }}
        $gap="md"
      >
        <Box $direction="row" $align="center" $justify="space-between">
          <StyledLink href="/">
            <Title headingLevel="h2" $size="1.4rem" />
          </StyledLink>
        </Box>
        <Text as="h1" $size="h4" $margin="none">
          {title}
        </Text>
        <Text $variation="secondary">
          {authenticated
            ? t(
                'Workspaces open to everyone on Collaborators, and public ones. Ask to join: their administrators approve.',
                { description: 'Explanation of the directory, signed in' },
              )
            : t(
                'Public workspaces. Sign in to find more, and to ask to join.',
                { description: 'Explanation of the directory, signed out' },
              )}
        </Text>
        <Input
          fullWidth
          label={t('Search by name or description', {
            description: 'Label of the directory search',
          })}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {isLoading ? (
          <Loading />
        ) : workspaces.length ? (
          <Box as="ul" $gap="sm" $margin="none" $padding="none">
            {workspaces.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </Box>
        ) : (
          <Text $variation="secondary">
            {t('No workspace to discover here yet.', {
              description: 'Shown when the directory is empty',
            })}
          </Text>
        )}
      </Box>
    </>
  );
};

export default Page;
