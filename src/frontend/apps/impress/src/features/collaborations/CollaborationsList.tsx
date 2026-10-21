import { Button } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Loading, StyledLink, Text } from '@/components';
import {
  useCreateDoc,
  useCreateFavoriteDoc,
  useDeleteFavoriteDoc,
  useTrans,
} from '@/features/docs/doc-management';
import { CreateSpaceModal } from '@/features/workspaces/components/CreateSpaceModal';
import { CreateWorkspaceModal } from '@/features/workspaces/components/CreateWorkspaceModal';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { useDate } from '@/hooks/useDate';

import {
  CollaborationDocument,
  CollaborationsView,
  KEY_COLLABORATIONS,
  useCollaborations,
  useStarWorkspace,
} from './api';

const rowCss = css`
  display: flex;
  align-items: center;
  gap: var(--c--globals--spacings--xs);
  padding: var(--c--globals--spacings--2xs) var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  color: inherit;
  text-decoration: none;
  flex: 1;
  min-width: 0;
  &:hover {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

const StarButton = ({
  starred,
  onToggle,
}: {
  starred: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  const label = starred
    ? t('Unstar', { description: 'Button removing a star' })
    : t('Star', { description: 'Button adding a star' });
  return (
    <BoxButton
      onClick={onToggle}
      aria-label={label}
      title={label}
      aria-pressed={starred}
      $padding="3xs"
    >
      <Icon
        iconName="star"
        variant={starred ? 'filled' : 'outlined'}
        $size="20px"
        $theme={starred ? 'warning' : 'neutral'}
        $variation={starred ? undefined : 'tertiary'}
      />
    </BoxButton>
  );
};

/** A group of the screen: a heading, a button creating one, the items. */
const Group = ({
  title,
  action,
  empty,
  children,
  count,
}: {
  title: string;
  action?: ReactNode;
  empty: string;
  children: ReactNode;
  count: number;
}) => (
  <Box $gap="2xs" as="section">
    <Box
      $direction="row"
      $align="center"
      $justify="space-between"
      $gap="sm"
      $css={css`
        border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
        padding-bottom: var(--c--globals--spacings--3xs);
      `}
    >
      <Text as="h2" $size="md" $weight="700" $margin="none">
        {title}
      </Text>
      {action}
    </Box>
    {count ? (
      children
    ) : (
      <Text $size="sm" $variation="secondary" $padding={{ horizontal: 'xs' }}>
        {empty}
      </Text>
    )}
  </Box>
);

const DocumentRow = ({ doc }: { doc: CollaborationDocument }) => {
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const star = useCreateFavoriteDoc({
    listInvalidQueries: [KEY_COLLABORATIONS],
  });
  const unstar = useDeleteFavoriteDoc({
    listInvalidQueries: [KEY_COLLABORATIONS],
  });
  return (
    <Box $direction="row" $align="center" $gap="2xs">
      <StyledLink href={`/docs/${doc.id}/`} $css={rowCss}>
        <Icon
          iconName={doc.kind === 'space' ? 'folder' : 'description'}
          $size="20px"
          $variation="secondary"
        />
        <Box $css="min-width: 0;">
          <Text $size="sm" $weight="500" $ellipsis>
            {doc.title || untitledDocument}
          </Text>
          <Text $size="xs" $variation="secondary">
            {relativeDate(doc.updated_at)}
          </Text>
        </Box>
      </StyledLink>
      <StarButton
        starred={doc.is_favorite}
        onToggle={() =>
          doc.is_favorite
            ? unstar.mutate({ id: doc.id })
            : star.mutate({ id: doc.id })
        }
      />
    </Box>
  );
};

/**
 * A list of "My collaborations": the workspaces, the spaces outside any
 * workspace and the pages outside any workspace or space one is involved in
 * (owns, recently, was let into, or starred).
 */
export const CollaborationsList = ({ view }: { view: CollaborationsView }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { relativeDate } = useDate();
  const { data, isLoading } = useCollaborations(view);
  const starWorkspace = useStarWorkspace();
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  const [creating, setCreating] = useState<'workspace' | 'space'>();
  const { mutate: createPage } = useCreateDoc({
    onSuccess: (doc) => void router.push(`/docs/${doc.id}/`),
  });
  const canCreate = view === 'owned';

  if (isLoading || !data) {
    return <Loading />;
  }

  const roles: Record<string, string> = {
    owner: t('Owner', { description: 'Role in a workspace' }),
    admin: t('Administrator', { description: 'Role in a workspace' }),
    member: t('Member', { description: 'Role in a workspace' }),
  };
  const newButton = (label: string, onClick: () => void) =>
    canCreate ? (
      <Button
        size="small"
        variant="secondary"
        icon={<Icon iconName="add" $color="inherit" $size="18px" />}
        onClick={onClick}
      >
        {label}
      </Button>
    ) : undefined;

  return (
    <Box $gap="md" data-testid={`collaborations-${view}`}>
      <Group
        title={t('Workspaces', { description: 'Group of My collaborations' })}
        count={data.workspaces.length}
        empty={t('No workspace here yet.', {
          description: 'Empty group of My collaborations',
        })}
        action={newButton(
          t('New workspace', { description: 'Button creating a workspace' }),
          () => setCreating('workspace'),
        )}
      >
        {data.workspaces.map((workspace) => (
          <Box key={workspace.id} $direction="row" $align="center" $gap="2xs">
            <StyledLink
              href="/"
              $css={rowCss}
              onClick={() => setCurrentWorkspaceId(workspace.id)}
            >
              <Icon iconName="workspaces" $size="20px" $variation="secondary" />
              <Box $css="min-width: 0;">
                <Text $size="sm" $weight="500" $ellipsis>
                  {workspace.name}
                </Text>
                <Text $size="xs" $variation="secondary">
                  {[
                    workspace.role && roles[workspace.role],
                    relativeDate(workspace.updated_at),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Box>
            </StyledLink>
            <StarButton
              starred={workspace.is_favorite}
              onToggle={() =>
                starWorkspace.mutate({
                  id: workspace.id,
                  starred: !workspace.is_favorite,
                })
              }
            />
          </Box>
        ))}
      </Group>

      <Group
        title={t('Spaces outside workspaces', {
          description: 'Group of My collaborations',
        })}
        count={data.spaces.length}
        empty={t('No space here yet.', {
          description: 'Empty group of My collaborations',
        })}
        action={newButton(
          t('New space', { description: 'Button creating a space' }),
          () => setCreating('space'),
        )}
      >
        {data.spaces.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </Group>

      <Group
        title={t('Pages outside workspaces and spaces', {
          description: 'Group of My collaborations',
        })}
        count={data.pages.length}
        empty={t('No page here yet.', {
          description: 'Empty group of My collaborations',
        })}
        action={newButton(
          t('New page', { description: 'Button creating a page' }),
          () => createPage({}),
        )}
      >
        {data.pages.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </Group>

      {creating === 'workspace' && (
        <CreateWorkspaceModal onClose={() => setCreating(undefined)} />
      )}
      {creating === 'space' && (
        <CreateSpaceModal onClose={() => setCreating(undefined)} />
      )}
    </Box>
  );
};
