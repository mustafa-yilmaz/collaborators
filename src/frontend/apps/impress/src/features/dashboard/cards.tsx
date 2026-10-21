import type { TFunction } from 'i18next';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { getEmojiAndTitle, useTrans } from '@/features/docs/doc-management';
import { labelHref } from '@/features/labels/LabelEditor';
import { useLabelCloud } from '@/features/labels/api';
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

/** One step of the hierarchy: an icon and its name. */
const Level = ({ icon, name }: { icon: string; name: string }) => (
  <Box
    $direction="row"
    $align="center"
    $gap="4xs"
    $padding={{ horizontal: 'xs', vertical: '4xs' }}
    $css={css`
      border-radius: 999px;
      background: var(
        --c--contextuals--background--semantic--contextual--primary
      );
    `}
  >
    <Icon iconName={icon} $size="18px" $variation="secondary" />
    <Text $size="sm" $weight="600">
      {name}
    </Text>
  </Box>
);

/**
 * A lean reminder of how things fit together: workspaces hold spaces,
 * spaces hold pages; pages can also sit directly in a workspace, or alone.
 */
const HierarchyBody = () => {
  const { t } = useTranslation();
  const arrow = (
    <Icon iconName="arrow_forward" $size="16px" $variation="tertiary" />
  );
  return (
    <Box $gap="xs" $padding={{ horizontal: 'xs' }} data-testid="hierarchy">
      <Box $direction="row" $align="center" $gap="2xs" $css="flex-wrap: wrap;">
        <Level
          icon="workspaces"
          name={t('Workspace', { description: 'Level of the hierarchy' })}
        />
        {arrow}
        <Level
          icon="folder"
          name={t('Space', { description: 'Level of the hierarchy' })}
        />
        {arrow}
        <Level
          icon="description"
          name={t('Page', { description: 'Level of the hierarchy' })}
        />
      </Box>
      <Text $size="sm" $variation="secondary">
        {t(
          'A workspace holds spaces, and a space holds pages. A page can also sit directly in a workspace, or stay on its own.',
          { description: 'Explanation of the hierarchy' },
        )}
      </Text>
    </Box>
  );
};

/** How many entries the "for me" card shows. */
const FOR_ME_SIZE = 8;

/**
 * Mentions, notifications and what is assigned to me (in tables or anywhere
 * in a page, directly or through a group), newest first. Assignments come
 * from the current list, not from their notifications, so that one done or
 * taken back leaves the card.
 */
const ForMeBody = () => {
  const { t } = useTranslation();
  const { relativeDate } = useDate();
  const { untitledDocument } = useTrans();
  const textOf = useNotificationText();
  const targetOf = useNotificationTarget();
  const { data: notifications = [], isLoading } = useNotifications(true);
  const { data: assigned = [], isLoading: isAssignedLoading } =
    useAssignedRows(true);
  const { markRead } = useNotificationMutations();

  const entries = [
    ...notifications
      .filter((notification) => notification.kind !== 'assignment')
      .map((notification) => ({
        key: `n-${notification.id}`,
        date: notification.created_at,
        notification,
        row: undefined,
      })),
    ...assigned.map((row) => ({
      key: `a-${row.id}`,
      date: row.updated_at,
      notification: undefined,
      row,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, FOR_ME_SIZE);

  if (!isLoading && !isAssignedLoading && !entries.length) {
    return (
      <Empty>
        {t('No mentions or assignments yet.', {
          description: 'Empty card of mentions, notifications and assignments',
        })}
      </Empty>
    );
  }

  return (
    <>
      {entries.map(({ key, notification, row }) => {
        if (row) {
          const doc = row.document.title || untitledDocument;
          // Opening it also reads the notification it came with
          const unread = notifications.filter(
            (item) =>
              item.kind === 'assignment' &&
              !item.read_at &&
              item.document?.id === row.document.id &&
              item.anchor_id === row.anchor_id,
          );
          return (
            <Row
              key={key}
              href={`/docs/${row.document.id}/#${row.anchor_id}`}
              icon="assignment_ind"
              title={
                row.row_label ||
                t('Something to do', {
                  description: 'An assignment without text',
                })
              }
              detail={[
                row.assigned_by
                  ? t('Assigned by {{name}} in {{doc}}', {
                      description: 'Who assigned it, and where',
                      name: row.assigned_by,
                      doc,
                    })
                  : t('Assigned in {{doc}}', {
                      description: 'Where it was assigned',
                      doc,
                    }),
                row.team_label &&
                  t('via {{group}}', {
                    description: 'Assigned through a group',
                    group: row.team_label,
                  }),
                relativeDate(row.updated_at),
              ]
                .filter(Boolean)
                .join(' · ')}
              onClick={() =>
                unread.forEach((item) => markRead.mutate({ id: item.id }))
              }
            />
          );
        }
        if (!notification) {
          return null;
        }
        const target = targetOf(notification);
        return (
          <Row
            key={key}
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
 * default mentions, notifications and assignments on the left, Labels on the
 * right, and Recent pages across, under them.
 */
/** A cloud of the labels of what one can see: the more used, the bigger. */
const LabelsBody = () => {
  const { t } = useTranslation();
  const { data = [], isLoading } = useLabelCloud();
  if (!isLoading && !data.length) {
    return (
      <Empty>
        {t(
          'Labels put on workspaces, spaces and pages appear here. Add some under a page’s title.',
          { description: 'Empty labels card' },
        )}
      </Empty>
    );
  }
  const max = Math.max(1, ...data.map((item) => item.count));
  const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Box
      $direction="row"
      $align="baseline"
      $gap="xs"
      $padding="xs"
      $css="flex-wrap: wrap; row-gap: 4px;"
      data-testid="label-cloud"
    >
      {sorted.map((item) => {
        const weight = item.count / max;
        return (
          <StyledLink
            key={item.name}
            href={labelHref(item.name)}
            title={t('{{count}} uses', {
              description: 'How many items carry a label',
              count: item.count,
            })}
            $css={css`
              font-size: ${0.8 + weight * 0.9}rem;
              font-weight: ${weight > 0.6 ? 700 : weight > 0.3 ? 600 : 400};
              color: var(--c--contextuals--content--semantic--brand--primary);
              opacity: ${0.6 + weight * 0.4};
              text-decoration: none;
              &:hover {
                text-decoration: underline;
              }
            `}
          >
            #{item.name}
          </StyledLink>
        );
      })}
    </Box>
  );
};

export const CARDS: CardDefinition[] = [
  // Mentions, notifications and assignments in one card (it keeps the id of
  // the notifications card, so saved layouts keep its place), beside Labels
  {
    id: 'notifications',
    icon: 'notifications',
    title: (t) =>
      t('Mentions, notifications, assignments', {
        description: 'Dashboard card',
      }),
    defaultVisible: true,
    Body: ForMeBody,
  },
  {
    id: 'labels',
    icon: 'sell',
    title: (t) => t('Labels', { description: 'Dashboard card' }),
    defaultVisible: true,
    Body: LabelsBody,
  },
  {
    id: 'recent',
    icon: 'schedule',
    title: (t) => t('Recent pages', { description: 'Dashboard card' }),
    defaultVisible: true,
    defaultWide: true,
    Body: RecentBody,
  },
  // A reminder of how workspaces, spaces and pages fit together
  {
    id: 'hierarchy',
    icon: 'account_tree',
    title: (t) => t('How it fits together', { description: 'Dashboard card' }),
    defaultVisible: true,
    Body: HierarchyBody,
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

/**
 * The saved layout, completed with the cards added since it was saved: those
 * shown on a fresh dashboard appear where they stand by default (before the
 * card that follows them there), the others stay hidden. The order someone
 * chose is kept.
 */
export const mergeLayout = (saved: CardLayout[]) => {
  const known = saved.filter((card) => CARDS.some((def) => def.id === card.id));
  if (!known.length) {
    return DEFAULT_LAYOUT;
  }
  const merged = [...known];
  DEFAULT_LAYOUT.forEach((card, index) => {
    if (merged.some((item) => item.id === card.id)) {
      return;
    }
    const next = DEFAULT_LAYOUT.slice(index + 1).find((later) =>
      merged.some((item) => item.id === later.id),
    );
    const at = next
      ? merged.findIndex((item) => item.id === next.id)
      : merged.length;
    merged.splice(at, 0, card);
  });
  return merged;
};
