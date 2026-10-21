import { Button } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Loading, StyledLink, Text } from '@/components';
import {
  CARD_ICON_GAP,
  CARD_ICON_SIZE,
  TEXT_INDENT,
} from '@/features/dashboard/CardParts';
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

// The icon column of the dashboard's cards, here too
const rowCss = css`
  display: flex;
  align-items: center;
  gap: ${CARD_ICON_GAP};
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
  compact,
}: {
  title: string;
  action?: ReactNode;
  empty: string;
  children: ReactNode;
  count: number;
  /** In a card: a smaller heading, and nothing said when it is empty */
  compact?: boolean;
}) =>
  compact && !count ? null : (
    <Box $gap="2xs" as="section" $css="min-width: 0;">
      <Box
        $direction="row"
        $align="center"
        $justify="space-between"
        $gap="sm"
        $css={
          compact
            ? css`
                /* In a card: over the titles of its rows */
                padding-inline-start: ${TEXT_INDENT};
              `
            : css`
                border-bottom: 1px solid
                  var(--c--contextuals--border--surface--primary);
                padding-bottom: var(--c--globals--spacings--3xs);
              `
        }
      >
        <Text
          as={compact ? 'h3' : 'h2'}
          $size={compact ? 'sm' : 'md'}
          $weight="700"
          $variation={compact ? 'secondary' : undefined}
          $margin="none"
        >
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
          $size={CARD_ICON_SIZE}
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
export const CollaborationsList = ({
  view,
  summary,
  wide,
}: {
  view: CollaborationsView;
  /**
   * On a dashboard card: at most this many of each group, without the
   * buttons creating one.
   */
  summary?: number;
  /** A summary across the dashboard: its groups side by side */
  wide?: boolean;
}) => {
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
  const canCreate = view === 'owned' && !summary;
  const compact = !!summary;

  if (isLoading || !data) {
    return <Loading />;
  }

  const workspaces = data.workspaces.slice(0, summary);
  const spaces = data.spaces.slice(0, summary);
  const pages = data.pages.slice(0, summary);
  if (compact && !workspaces.length && !spaces.length && !pages.length) {
    return (
      <Text
        $size="sm"
        $variation="secondary"
        $css={css`
          padding-inline: ${TEXT_INDENT} var(--c--globals--spacings--xs);
        `}
        data-testid={`collaborations-${view}`}
      >
        {t('Nothing here yet.', {
          description: 'Empty summary of a list of My collaborations',
        })}
      </Text>
    );
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
    <Box
      $gap="md"
      data-testid={`collaborations-${view}`}
      $css={
        wide
          ? css`
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              align-items: start;
            `
          : undefined
      }
    >
      <Group
        title={t('Workspaces', { description: 'Group of My collaborations' })}
        count={workspaces.length}
        compact={compact}
        empty={t('No workspace here yet.', {
          description: 'Empty group of My collaborations',
        })}
        action={newButton(
          t('New workspace', { description: 'Button creating a workspace' }),
          () => setCreating('workspace'),
        )}
      >
        {workspaces.map((workspace) => (
          <Box key={workspace.id} $direction="row" $align="center" $gap="2xs">
            <StyledLink
              href="/"
              $css={rowCss}
              onClick={() => setCurrentWorkspaceId(workspace.id)}
            >
              <Icon
                iconName="workspaces"
                $size={CARD_ICON_SIZE}
                $variation="secondary"
              />
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
        count={spaces.length}
        compact={compact}
        empty={t('No space here yet.', {
          description: 'Empty group of My collaborations',
        })}
        action={newButton(
          t('New space', { description: 'Button creating a space' }),
          () => setCreating('space'),
        )}
      >
        {spaces.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} />
        ))}
      </Group>

      <Group
        title={t('Pages outside workspaces and spaces', {
          description: 'Group of My collaborations',
        })}
        count={pages.length}
        compact={compact}
        empty={t('No page here yet.', {
          description: 'Empty group of My collaborations',
        })}
        action={newButton(
          t('New page', { description: 'Button creating a page' }),
          () => createPage({}),
        )}
      >
        {pages.map((doc) => (
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
