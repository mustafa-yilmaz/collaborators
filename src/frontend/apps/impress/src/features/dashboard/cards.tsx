import type { TFunction } from 'i18next';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { getEmojiAndTitle, useTrans } from '@/features/docs/doc-management';
import {
  useNotificationTarget,
  useNotificationText,
} from '@/features/notifications/NotificationBell';
import {
  useNotificationMutations,
  useNotifications,
} from '@/features/notifications/api';
import {
  useSpaces,
  useWorkspaceStore,
  useWorkspaces,
} from '@/features/workspaces';
import { useDate } from '@/hooks/useDate';

import {
  CardLayout,
  RecentDoc,
  useAssignedRows,
  useDocsList,
  useRecentDocs,
} from './api';

export interface CardDefinition {
  id: string;
  icon: string;
  title: (t: TFunction<'translation', undefined>) => string;
  /** Shown on a fresh dashboard; the others can be added. */
  defaultVisible: boolean;
  /** Across both columns on a fresh dashboard */
  defaultWide?: boolean;
  Body: (props: BodyProps) => ReactNode;
}

/** What a card's body knows of its card: whether it goes across. */
export interface BodyProps {
  wide?: boolean;
}

const rowCss = css`
  display: flex;
  align-items: center;
  gap: var(--c--globals--spacings--xs);
  padding: var(--c--globals--spacings--2xs) var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  color: inherit;
  text-decoration: none;
  width: 100%;
  &:hover {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

const Row = ({
  href,
  icon,
  title,
  detail,
  onClick,
}: {
  href: string;
  icon: string;
  title: string;
  detail?: string;
  onClick?: () => void;
}) => (
  <StyledLink href={href} $css={rowCss} onClick={onClick}>
    <Icon iconName={icon} $size="20px" $variation="secondary" />
    <Box $flex={1} $css="min-width: 0;">
      <Text $size="sm" $weight="500" $ellipsis>
        {title}
      </Text>
      {detail && (
        <Text $size="xs" $variation="secondary" $ellipsis>
          {detail}
        </Text>
      )}
    </Box>
  </StyledLink>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <Text $size="sm" $variation="secondary" $padding={{ horizontal: 'xs' }}>
    {children}
  </Text>
);

/** A page as a tile: its emoji or icon, title, first words and space. */
const RecentTile = ({ doc }: { doc: RecentDoc }) => {
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const { emoji, titleWithoutEmoji } = getEmojiAndTitle(
    doc.title || untitledDocument,
  );
  const isSpace = doc.kind === 'space';
  return (
    <StyledLink
      href={`/docs/${doc.id}`}
      $css={css`
        display: flex;
        flex-direction: column;
        min-width: 0;
        border: 1px solid var(--c--contextuals--border--surface--primary);
        border-radius: var(--c--globals--spacings--xs);
        overflow: hidden;
        color: inherit;
        text-decoration: none;
        transition:
          border-color 0.15s,
          box-shadow 0.15s;
        &:hover {
          border-color: var(--c--globals--colors--brand-400);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }
      `}
    >
      <Box
        $height="64px"
        $align="center"
        $justify="center"
        $css={css`
          background: ${
            isSpace
              ? 'var(--c--contextuals--background--semantic--brand--tertiary)'
              : 'var(--c--contextuals--background--semantic--contextual--primary)'
          };
          font-size: 28px;
        `}
      >
        {emoji ? (
          <span aria-hidden="true">{emoji}</span>
        ) : (
          <Icon
            iconName={isSpace ? 'folder' : 'description'}
            $size="28px"
            $variation="secondary"
          />
        )}
      </Box>
      <Box $padding="xs" $gap="4xs" $css="min-width: 0;">
        <Text
          $size="sm"
          $weight="600"
          $css={css`
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          `}
        >
          {titleWithoutEmoji || untitledDocument}
        </Text>
        {doc.excerpt && (
          <Text
            $size="xs"
            $variation="secondary"
            $css={css`
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            `}
          >
            {doc.excerpt}
          </Text>
        )}
        <Text $size="xs" $variation="secondary" $ellipsis>
          {[doc.space?.title, relativeDate(doc.updated_at)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </Box>
    </StyledLink>
  );
};

const RecentBody = ({ wide }: BodyProps) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const { data = [], isLoading } = useRecentDocs(true);
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t('Pages you and your teams work on will appear here.', {
          description: 'Empty Recent pages card',
        })}
      </Empty>
    );
  }
  // With the room of both columns, pages show as tiles
  if (wide) {
    return (
      <Box
        $css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: var(--c--globals--spacings--xs);
        `}
      >
        {data.map((doc) => (
          <RecentTile key={doc.id} doc={doc} />
        ))}
      </Box>
    );
  }
  return (
    <>
      {data.map((doc) => (
        <Row
          key={doc.id}
          href={`/docs/${doc.id}`}
          icon={doc.kind === 'space' ? 'folder' : 'description'}
          title={doc.title || untitledDocument}
          detail={[doc.space?.title, relativeDate(doc.updated_at)]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
    </>
  );
};

const NotificationsBody = () => {
  const { t } = useTranslation();
  const { relativeDate } = useDate();
  const textOf = useNotificationText();
  const targetOf = useNotificationTarget();
  const { data = [], isLoading } = useNotifications(true);
  const { markRead } = useNotificationMutations();
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t('No mentions yet.', { description: 'Empty notifications card' })}
      </Empty>
    );
  }
  return (
    <>
      {data.slice(0, 5).map((notification) => {
        const target = targetOf(notification);
        return (
          <Row
            key={notification.id}
            href={target.href}
            icon={
              notification.read_at ? 'notifications' : 'notifications_active'
            }
            title={textOf(notification)}
            detail={relativeDate(notification.created_at)}
            onClick={() => {
              target.beforeOpen?.();
              if (!notification.read_at) {
                markRead.mutate({ id: notification.id });
              }
            }}
          />
        );
      })}
    </>
  );
};

const AssignedBody = () => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const { data = [], isLoading } = useAssignedRows(true);
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t('Nothing is assigned to you or your groups in tables.', {
          description: 'Empty Assigned to me card',
        })}
      </Empty>
    );
  }
  return (
    <>
      {data.map((row) => (
        <Row
          key={row.id}
          href={`/docs/${row.document.id}/#${row.anchor_id}`}
          icon="assignment_ind"
          title={
            row.row_label ||
            t('A table row', { description: 'Assigned row without text' })
          }
          detail={[
            row.document.title || untitledDocument,
            row.team_label &&
              t('via {{group}}', {
                description: 'Assigned through a group',
                group: row.team_label,
              }),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      ))}
    </>
  );
};

const DocsBody = ({
  listKey,
  query,
  empty,
}: {
  listKey: string;
  query: string;
  empty: string;
}) => {
  const { untitledDocument } = useTrans();
  const { relativeDate } = useDate();
  const { data = [], isLoading } = useDocsList(listKey, query, true);
  if (!isLoading && !data.length) {
    return <Empty>{empty}</Empty>;
  }
  return (
    <>
      {data.map((doc) => (
        <Row
          key={doc.id}
          href={`/docs/${doc.id}`}
          icon="description"
          title={doc.title || untitledDocument}
          detail={relativeDate(doc.updated_at)}
        />
      ))}
    </>
  );
};

const SpacesBody = () => {
  const { t } = useTranslation();
  const { data = [], isLoading } = useSpaces({ mine: true });
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t('Spaces you belong to will appear here.', {
          description: 'Empty My spaces card',
        })}
      </Empty>
    );
  }
  return (
    <>
      {data.slice(0, 8).map((space) => (
        <Row
          key={space.id}
          href={`/docs/${space.id}`}
          icon="folder"
          title={
            space.title ||
            t('Untitled space', {
              description: 'Name of a space without title',
            })
          }
          detail={space.home_workspace?.name}
        />
      ))}
    </>
  );
};

const WorkspacesBody = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { data = [], isLoading } = useWorkspaces();
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t('Create or join a workspace from the left panel.', {
          description: 'Empty My workspaces card',
        })}
      </Empty>
    );
  }
  return (
    <>
      {data.map((workspace) => (
        <Row
          key={workspace.id}
          href={`/workspaces/${workspace.id}/settings`}
          icon="workspaces"
          title={workspace.name}
          detail={t('Open its spaces', {
            description: 'Detail of a workspace in the dashboard',
          })}
          onClick={() => {
            setCurrentWorkspaceId(workspace.id);
            void router.push('/');
          }}
        />
      ))}
    </>
  );
};

/**
 * Every card the dashboard can show, in their default order. Cards sit in two
 * columns, in turn left and right, and a wide card goes across both: by
 * default Mentions & notifications on the left, Assigned to me on the right,
 * and Recent pages across, under them.
 */
export const CARDS: CardDefinition[] = [
  {
    id: 'notifications',
    icon: 'notifications',
    title: (t) =>
      t('Mentions & notifications', { description: 'Dashboard card' }),
    defaultVisible: true,
    Body: NotificationsBody,
  },
  {
    id: 'assigned',
    icon: 'assignment_ind',
    title: (t) => t('Assigned to me', { description: 'Dashboard card' }),
    defaultVisible: true,
    Body: AssignedBody,
  },
  {
    id: 'recent',
    icon: 'schedule',
    title: (t) => t('Recent pages', { description: 'Dashboard card' }),
    defaultVisible: true,
    defaultWide: true,
    Body: RecentBody,
  },
  {
    id: 'favorites',
    icon: 'star',
    title: (t) => t('Favorites', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: function FavoritesBody() {
      const { t } = useTranslation();
      return (
        <DocsBody
          listKey="favorites"
          query="documents/favorite_list/"
          empty={t('Star a page to find it here.', {
            description: 'Empty Favorites card',
          })}
        />
      );
    },
  },
  {
    id: 'spaces',
    icon: 'folder',
    title: (t) => t('My spaces', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: SpacesBody,
  },
  {
    id: 'workspaces',
    icon: 'workspaces',
    title: (t) => t('My workspaces', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: WorkspacesBody,
  },
  {
    id: 'shared',
    icon: 'group',
    title: (t) => t('Shared with me', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: function SharedBody() {
      const { t } = useTranslation();
      return (
        <DocsBody
          listKey="shared"
          query="documents/?is_creator_me=false&ordering=-updated_at"
          empty={t('Pages others share with you will appear here.', {
            description: 'Empty Shared with me card',
          })}
        />
      );
    },
  },
  {
    id: 'pages',
    icon: 'description',
    title: (t) => t('Independent pages', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: function PagesBody() {
      const { t } = useTranslation();
      return (
        <DocsBody
          listKey="pages"
          query="documents/?ordering=-updated_at"
          empty={t('Pages outside spaces will appear here.', {
            description: 'Empty Independent pages card',
          })}
        />
      );
    },
  },
];

export const DEFAULT_LAYOUT = CARDS.map((card) => ({
  id: card.id,
  hidden: !card.defaultVisible,
  collapsed: false,
  wide: !!card.defaultWide,
}));

/** The saved layout, completed with the cards added since it was saved. */
export const mergeLayout = (saved: CardLayout[]) => {
  const known = saved.filter((card) => CARDS.some((def) => def.id === card.id));
  const missing = DEFAULT_LAYOUT.filter(
    (card) => !known.some((item) => item.id === card.id),
  ).map((card) => ({ ...card, hidden: known.length ? true : card.hidden }));
  return known.length ? [...known, ...missing] : DEFAULT_LAYOUT;
};
