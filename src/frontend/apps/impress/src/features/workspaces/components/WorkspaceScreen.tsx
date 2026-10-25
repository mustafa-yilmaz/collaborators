import { useRouter } from 'next/router';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, BoxButton, Icon, SCREEN_MAX_WIDTH, Text } from '@/components';
import { useCreateDoc, useTrans } from '@/features/docs/doc-management';
import { LogoSquare } from '@/features/invitations/LogoPicker';
import { LabelEditor } from '@/features/labels/LabelEditor';
import { useDate } from '@/hooks/useDate';
import { useResponsiveStore } from '@/stores';

import { useSpaces, useWorkspaces } from '../api';
import { Space } from '../types';

import { CreateSpaceModal } from './CreateSpaceModal';
import { ItemCard, Section } from './FolderItems';
import { PlaceInWorkspace } from './PageList';

/**
 * Collaborators: /workspace/<id>/ — a workspace's own screen: its logo,
 * name, description and labels, then its spaces as folders and the pages
 * placed directly in it as documents.
 */
export const WorkspaceScreen = ({ workspaceId }: { workspaceId: string }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isMobile } = useResponsiveStore();
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const { data: workspaces, isLoading } = useWorkspaces();
  const workspace = workspaces?.find((ws) => ws.id === workspaceId);
  const { data: spaces = [] } = useSpaces({ workspaceId }, !!workspace);
  const { data: pages = [] } = useSpaces(
    { workspaceId, pages: true },
    !!workspace,
  );
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [placing, setPlacing] = useState<string>();
  const { mutate: createPage, isPending } = useCreateDoc({
    onSuccess: (doc) => setPlacing(doc.id),
  });

  if (isLoading) {
    return null;
  }

  const screen = (children: ReactNode) => (
    <Box
      $width="100%"
      $maxWidth={SCREEN_MAX_WIDTH}
      $margin={{ horizontal: 'auto' }}
      $padding={{ horizontal: isMobile ? 'sm' : 'lg', vertical: 'lg' }}
      $gap="lg"
      className="--collaborators--workspace-screen"
    >
      {children}
    </Box>
  );

  if (!workspace) {
    return screen(
      <Text $variation="secondary">
        {t(
          "This workspace isn't one of yours: find it, and ask to join, in Search.",
          { description: 'Workspace screen of a workspace one is not in' },
        )}
      </Text>,
    );
  }

  /** Who placed a shared space here: another workspace, its home. */
  const sharedFrom = (space: Space) =>
    space.linked_workspaces.find((link) => link.is_home)?.id !== workspace.id
      ? space.linked_workspaces.find((link) => link.is_home)?.name
      : undefined;

  return screen(
    <>
      <Box $direction="row" $align="center" $gap="md">
        <LogoSquare
          owner="workspaces"
          id={workspace.id}
          size={64}
          fallbackIcon="workspaces"
        />
        <Box $flex={1} $gap="3xs" $css="min-width: 0;">
          <Text as="h1" $size="h4" $margin="none" $ellipsis>
            {workspace.name}
          </Text>
          {workspace.description && (
            <Text $variation="secondary">{workspace.description}</Text>
          )}
          <LabelEditor path={`workspaces/${workspace.id}`} hideWhenEmpty />
        </Box>
        {workspace.abilities.update && (
          <BoxButton
            onClick={() =>
              void router.push(`/workspaces/${workspace.id}/settings`)
            }
            aria-label={t('Workspace settings', {
              description: 'Menu entry opening the settings of a workspace',
            })}
            title={t('Workspace settings', {
              description: 'Menu entry opening the settings of a workspace',
            })}
            $padding="2xs"
            $css="border-radius: 4px;"
          >
            <Icon iconName="settings" $size="22px" $variation="secondary" />
          </BoxButton>
        )}
      </Box>

      <Section
        testId="workspace-spaces"
        title={t('Spaces', { description: 'Heading of the list of spaces' })}
        newLabel={t('New space', { description: 'Button creating a space' })}
        onNew={
          workspace.abilities.spaces_create
            ? () => setIsCreatingSpace(true)
            : undefined
        }
        empty={
          spaces.length
            ? null
            : t('No space here yet.', {
                description: 'Workspace screen without spaces',
              })
        }
      >
        {spaces.map((space) => (
          <ItemCard
            key={space.id}
            href={`/space/${space.id}/`}
            icon={
              <LogoSquare
                owner="documents"
                id={space.id}
                size={44}
                fallbackIcon="folder"
              />
            }
            title={space.title || untitledDocument}
            details={[
              sharedFrom(space) &&
                t('Shared from {{workspace}}', {
                  description: 'A space placed in a workspace by another',
                  workspace: sharedFrom(space),
                }),
              relativeDate(space.updated_at),
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </Section>

      <Section
        testId="workspace-pages"
        title={t('Pages', {
          description: 'Heading of the pages outside any space',
        })}
        newLabel={t('New page', {
          description: 'Button creating a page outside any space',
        })}
        onNew={
          workspace.abilities.spaces_create
            ? () => !isPending && createPage({})
            : undefined
        }
        empty={
          pages.length
            ? null
            : t('No page placed directly in this workspace yet.', {
                description: 'Workspace screen without pages of its own',
              })
        }
      >
        {pages.map((page) => (
          <ItemCard
            key={page.id}
            href={`/page/${page.id}/`}
            icon={
              <LogoSquare
                owner="documents"
                id={page.id}
                size={44}
                fallbackIcon="description"
              />
            }
            title={page.title || untitledDocument}
            details={relativeDate(page.updated_at)}
          />
        ))}
      </Section>

      {isCreatingSpace && (
        <CreateSpaceModal
          workspace={workspace}
          onClose={() => setIsCreatingSpace(false)}
        />
      )}
      {placing && (
        <PlaceInWorkspace
          pageId={placing}
          workspaceId={workspace.id}
          onDone={() => void router.push(`/page/${placing}/`)}
        />
      )}
    </>,
  );
};
