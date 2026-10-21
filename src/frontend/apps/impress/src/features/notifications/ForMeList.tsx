import { Switch } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Text } from '@/components';
import { Empty, Row, SeeAll } from '@/features/dashboard/CardParts';
import { useAssignedRows } from '@/features/dashboard/api';
import { useTrans } from '@/features/docs/doc-management';
import { useDate } from '@/hooks/useDate';

import {
  useNotificationMutations,
  useNotificationPreferences,
  useNotifications,
} from './api';
import { useNotificationTarget, useNotificationText } from './hooks';

/** Where the full list is: its screen in "My collaborations". */
export const NOTIFICATIONS_HREF = '/?target=notifications';

/**
 * How many entries a summary shows: the same on the dashboard's card and in
 * the bell's popup.
 */
export const FOR_ME_SIZE = 8;

/**
 * Whether notifications are also sent by email: one setting, so the switch
 * of the bell, of the card and of the screen move together. Off until one
 * turns it on.
 */
export const EmailSwitch = () => {
  const { t } = useTranslation();
  const { query, update } = useNotificationPreferences(true);
  return (
    <Box
      $padding={{ horizontal: 'xs', top: 'xs' }}
      $css={css`
        border-top: 1px solid var(--c--contextuals--border--surface--primary);
      `}
    >
      <Switch
        labelSide="right"
        label={t('Also send me an email', {
          description: 'Email preference of the notification inbox',
        })}
        checked={query.data?.email ?? false}
        disabled={!query.data}
        onChange={(event) => update.mutate({ email: event.target.checked })}
      />
    </Box>
  );
};

/**
 * Mentions, notifications and what is assigned to me (in tables or anywhere
 * in a page, directly or through a group), newest first: a summary on the
 * dashboard's card and in the bell, everything on its own screen.
 * Assignments come from the current list, not from their notifications, so
 * that one done or taken back leaves the list.
 */
export const ForMeList = ({
  full = false,
  onOpen,
  emailSwitch = true,
}: {
  full?: boolean;
  /** Called as an entry or "See all" is opened, e.g. to close a popup. */
  onOpen?: () => void;
  /** Without the email switch, for a popup keeping it below its scroll */
  emailSwitch?: boolean;
}) => {
  const { t } = useTranslation();
  const { relativeDate } = useDate();
  const { untitledDocument } = useTrans();
  const textOf = useNotificationText();
  const targetOf = useNotificationTarget();
  const { data: notifications = [], isLoading } = useNotifications(true);
  const { data: assigned = [], isLoading: isAssignedLoading } =
    useAssignedRows(true);
  const { markRead, markAllRead } = useNotificationMutations();

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
  ].sort((a, b) => b.date.localeCompare(a.date));
  const shown = full ? entries : entries.slice(0, FOR_ME_SIZE);
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const empty = !isLoading && !isAssignedLoading && !entries.length;

  return (
    <>
      {empty && (
        <Empty>
          {t('No mentions or assignments yet.', {
            description:
              'Empty card of mentions, notifications and assignments',
          })}
        </Empty>
      )}
      {full && unreadCount > 0 && (
        <Box $direction="row" $justify="flex-end">
          <BoxButton
            onClick={() => markAllRead.mutate()}
            $padding={{ horizontal: 'xs', vertical: '4xs' }}
          >
            <Text $size="sm" $theme="brand">
              {t('Mark all as read', {
                description: 'Button reading every notification',
              })}
            </Text>
          </BoxButton>
        </Box>
      )}
      {shown.map(({ key, notification, row }) => {
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
              onClick={() => {
                unread.forEach((item) => markRead.mutate({ id: item.id }));
                onOpen?.();
              }}
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
              onOpen?.();
            }}
          />
        );
      })}
      {!full && !empty && <SeeAll href={NOTIFICATIONS_HREF} onClick={onOpen} />}
      {emailSwitch && <EmailSwitch />}
    </>
  );
};
