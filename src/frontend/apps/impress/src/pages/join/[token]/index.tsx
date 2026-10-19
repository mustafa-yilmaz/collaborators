import { Button } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';

import { Box, Loading, Text } from '@/components';
import { Title } from '@/components/Title';
import { gotoLogin, useAuth } from '@/features/auth';
import { useJoinPreview, useJoinWorkspace } from '@/features/workspaces/api';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { NextPageWithLayout } from '@/types/next';

/**
 * /join/<token>: a workspace's join link. Signed out, it asks to sign in
 * first (and comes back here); signed in, one click joins.
 */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query, push } = useRouter();
  const token = typeof query.token === 'string' ? query.token : '';
  const { authenticated, isAuthLoading } = useAuth();
  const { data: workspace, isLoading, isError } = useJoinPreview(token);
  const join = useJoinWorkspace(token);
  const { setCurrentWorkspaceId } = useWorkspaceStore();

  const open = () => {
    if (workspace) {
      setCurrentWorkspaceId(workspace.id);
      void push('/');
    }
  };

  let body;
  if (isLoading || isAuthLoading || !token) {
    body = <Loading />;
  } else if (isError || !workspace) {
    body = (
      <Text $variation="secondary" $textAlign="center">
        {t('This join link does not work any more. Ask for a new one.', {
          description: 'Join page with a wrong or old link',
        })}
      </Text>
    );
  } else {
    body = (
      <Box $align="center" $gap="sm">
        <Text as="h2" $size="h4" $margin="none" $textAlign="center">
          {t('Join {{name}}', {
            description: 'Heading of the join page',
            name: workspace.name,
          })}
        </Text>
        {workspace.description && (
          <Text $variation="secondary" $textAlign="center">
            {workspace.description}
          </Text>
        )}
        <Text $size="sm" $variation="secondary">
          {workspace.member_count === 1
            ? t('1 member', { description: 'Number of members of a workspace' })
            : t('{{count}} members', {
                description: 'Number of members of a workspace',
                count: workspace.member_count,
              })}
        </Text>
        {workspace.is_member ? (
          <Button onClick={open}>
            {t('You are a member: open the workspace', {
              description: 'Join page, already a member',
            })}
          </Button>
        ) : authenticated ? (
          <Button
            disabled={join.isPending}
            onClick={() => join.mutate(undefined, { onSuccess: open })}
          >
            {t('Join the workspace', { description: 'Join page button' })}
          </Button>
        ) : (
          <Button onClick={() => gotoLogin()}>
            {t('Sign in to join', { description: 'Join page button' })}
          </Button>
        )}
        {join.isError && (
          <Text $size="sm" $theme="error" role="alert">
            {join.error.cause?.[0] ??
              t('Something went wrong.', {
                description: 'Generic error message',
              })}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>{workspace ? workspace.name : 'Collaborators'}</title>
        <meta name="robots" content="noindex" key="robots" />
      </Head>
      <Box
        as="main"
        $height="100vh"
        $align="center"
        $justify="center"
        $gap="lg"
        $padding="md"
      >
        <Title headingLevel="h1" $size="2rem" />
        <Box $maxWidth="420px" $width="100%" $align="center">
          {body}
        </Box>
      </Box>
    </>
  );
};

export default Page;
