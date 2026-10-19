import { Button, Switch } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { AnchoredPanel } from '@/components/popover/AnchoredPanel';
import { useAuth } from '@/features/auth';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { useDate } from '@/hooks/useDate';

import {
  Notification,
  useNotificationMutations,
  useNotificationPreferences,
  useNotifications,
  useUnreadCount,
} from './api';

/**
 * Where a notification leads: its place in a document, or, for joining, the
 * workspace's settings (a request to answer) or the workspace (let in).
 */
export const useNotificationTarget = () => {
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  return (notification: Notification) => {
    if (notification.kind === 'join_request' && notification.workspace) {
      return { href: `/workspaces/${notification.workspace.id}/settings/` };
    }
    if (notification.kind === 'join_approved' && notification.workspace) {
      const workspaceId = notification.workspace.id;
      return {
        href: '/',
        beforeOpen: () => setCurrentWorkspaceId(workspaceId),
      };
    }
    const anchor = notification.anchor_id ? `#${notification.anchor_id}` : '';
    return { href: `/docs/${notification.document?.id}/${anchor}` };
  };
};

/** The icon of a notification, by its kind. */
export const notificationIcon = (notification: Notification) =>
  ({
    assignment: 'assignment_ind',
    comment_mention: 'chat',
    join_request: 'person_add',
    join_approved: 'how_to_reg',
    mention: 'alternate_email',
  })[notification.kind] ?? 'alternate_email';

/** The sentence describing a notification, e.g. "Ada mentioned you in Plan". */
export const useNotificationText = () => {
  const { t } = useTranslation();
  return (notification: Notification) => {
    const name =
      notification.actor?.full_name ??
      t('Someone', { description: 'Unknown author of a notification' });
    const workspace = notification.workspace?.name ?? '';
    if (notification.kind === 'join_request') {
      return t('{{name}} asks to join {{workspace}}', {
        description: 'Notification of a request to join a workspace',
        name,
        workspace,
      });
    }
    if (notification.kind === 'join_approved') {
      return t('{{name}} let you in {{workspace}}', {
        description: 'Notification of an approved request to join',
        name,
        workspace,
      });
    }
    const doc =
      notification.document?.title ||
      t('Untitled document', { description: 'Name of a doc without title' });
    const group = notification.team_label;

    if (notification.kind === 'assignment') {
      return group
        ? t('{{name}} assigned {{group}} in {{doc}}', {
            description: 'Notification of a table assignment to a group',
            name,
            group,
            doc,
          })
        : t('{{name}} assigned you in {{doc}}', {
            description: 'Notification of a table assignment',
            name,
            doc,
          });
    }
    if (notification.kind === 'comment_mention') {
      return group
        ? t('{{name}} mentioned {{group}} in a comment in {{doc}}', {
            description: 'Notification of a group mention in a comment',
            name,
            group,
            doc,
          })
        : t('{{name}} mentioned you in a comment in {{doc}}', {
            description: 'Notification of a mention in a comment',
            name,
            doc,
          });
    }
    return group
      ? t('{{name}} mentioned {{group}} in {{doc}}', {
          description: 'Notification of a group mention',
          name,
          group,
          doc,
        })
      : t('{{name}} mentioned you in {{doc}}', {
          description: 'Notification of a mention',
          name,
          doc,
        });
  };
};

/** The bell of the left panel: unread count and the notification inbox. */
export const NotificationBell = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { authenticated } = useAuth();
  const [opened, setOpened] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { data: unread } = useUnreadCount(authenticated);
  const { data: notifications = [], isLoading } = useNotifications(
    authenticated && opened,
  );
  const { markRead, markAllRead } = useNotificationMutations();
  const { query: preferences, update } = useNotificationPreferences(
    authenticated && opened,
  );
  const { relativeDate } = useDate();
  const textOf = useNotificationText();
  const targetOf = useNotificationTarget();

  if (!authenticated) {
    return null;
  }

  const count = unread?.count ?? 0;

  const open = (notification: Notification) => {
    if (!notification.read_at) {
      markRead.mutate({ id: notification.id });
    }
    setOpened(false);
    const target = targetOf(notification);
    target.beforeOpen?.();
    void router.push(target.href);
  };

  return (
    <>
      <BoxButton
        ref={bellRef}
        onClick={() => setOpened((value) => !value)}
        aria-label={
          count
            ? t('Notifications, {{count}} unread', {
                description: 'Accessible name of the notification bell',
                count,
              })
            : t('Notifications', {
                description: 'Accessible name of the notification bell',
              })
        }
        aria-expanded={opened}
        $position="relative"
        $padding="3xs"
        $css="border-radius: 4px;"
      >
        <Icon
          iconName={count ? 'notifications_active' : 'notifications'}
          $size="22px"
          $variation="secondary"
        />
        {count > 0 && (
          <Box
            as="span"
            aria-hidden="true"
            $position="absolute"
            $css={css`
              top: 0;
              right: 0;
              min-width: 16px;
              height: 16px;
              padding: 0 4px;
              border-radius: 999px;
              background: var(--c--globals--colors--brand-500);
              color: white;
              font-size: 10px;
              font-weight: 700;
              line-height: 16px;
              text-align: center;
            `}
          >
            {count > 99 ? '99+' : count}
          </Box>
        )}
      </BoxButton>
      {opened && (
        <AnchoredPanel
          anchorRef={bellRef}
          onClose={() => setOpened(false)}
          label={t('Notifications', {
            description: 'Accessible name of the notification bell',
          })}
        >
          <Box
            $width="360px"
            $css="max-width: calc(100vw - 32px);"
            className="--collaborators--notifications"
          >
            <Box
              $direction="row"
              $align="center"
              $justify="space-between"
              $padding={{ horizontal: 'sm', vertical: 'xs' }}
            >
              <Text as="h2" $size="md" $weight="700" $margin="none">
                {t('Notifications', {
                  description: 'Accessible name of the notification bell',
                })}
              </Text>
              {count > 0 && (
                <Button
                  size="small"
                  variant="tertiary"
                  onClick={() => markAllRead.mutate()}
                >
                  {t('Mark all as read', {
                    description: 'Button of the notification inbox',
                  })}
                </Button>
              )}
            </Box>
            <Box $css="max-height: 420px; overflow-y: auto;" role="list">
              {!isLoading && notifications.length === 0 && (
                <Text
                  $size="sm"
                  $variation="secondary"
                  $padding={{ horizontal: 'sm', bottom: 'sm' }}
                >
                  {t(
                    'Nothing yet. You will see here when someone mentions you or assigns you a task.',
                    { description: 'Empty notification inbox' },
                  )}
                </Text>
              )}
              {notifications.map((notification) => (
                <BoxButton
                  key={notification.id}
                  role="listitem"
                  onClick={() => open(notification)}
                  $direction="row"
                  $gap="xs"
                  $width="100%"
                  $padding={{ horizontal: 'sm', vertical: 'xs' }}
                  $css={css`
                    text-align: left;
                    border-top: 1px solid
                      var(--c--contextuals--border--surface--primary);
                    background: ${
                      notification.read_at
                        ? 'transparent'
                        : 'var(--c--contextuals--background--semantic--brand--tertiary)'
                    };
                    &:hover {
                      background: var(
                        --c--contextuals--background--semantic--contextual--primary
                      );
                    }
                  `}
                >
                  <Icon
                    iconName={notificationIcon(notification)}
                    $size="20px"
                    $variation="secondary"
                  />
                  <Box $flex={1}>
                    <Text
                      $size="sm"
                      $weight={notification.read_at ? '400' : '600'}
                    >
                      {textOf(notification)}
                    </Text>
                    <Text $size="xs" $variation="secondary">
                      {relativeDate(notification.created_at)}
                    </Text>
                  </Box>
                  {!notification.read_at && (
                    <Box
                      aria-label={t('Unread', {
                        description: 'Marker of an unread notification',
                      })}
                      $css={css`
                        width: 8px;
                        height: 8px;
                        margin-top: 6px;
                        border-radius: 50%;
                        background: var(--c--globals--colors--brand-500);
                      `}
                    />
                  )}
                </BoxButton>
              ))}
            </Box>
            <Box
              $padding={{ horizontal: 'sm', vertical: 'xs' }}
              $css={css`
                border-top: 1px solid
                  var(--c--contextuals--border--surface--primary);
              `}
            >
              <Switch
                labelSide="right"
                label={t('Also send me an email', {
                  description: 'Email preference of the notification inbox',
                })}
                checked={preferences.data?.email ?? true}
                disabled={!preferences.data}
                onChange={(event) =>
                  update.mutate({ email: event.target.checked })
                }
              />
            </Box>
          </Box>
        </AnchoredPanel>
      )}
    </>
  );
};
