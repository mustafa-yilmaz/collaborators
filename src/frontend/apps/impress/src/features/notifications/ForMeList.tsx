import { Button, Switch } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
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
export const EmailSwitch = ({ bare = false }: { bare?: boolean }) => {
  const { t } = useTranslation();
  const { query, update } = useNotificationPreferences(true);
  return (
    <Box
      // First, above the list (however long it is), a line under it
      $padding={bare ? undefined : { horizontal: 'xs', bottom: 'xs' }}
      $css={
        bare
          ? undefined
          : css`
              border-bottom: 1px solid
                var(--c--contextuals--border--surface--primary);
            `
      }
    >
      <Switch
        labelSide="right"
        label={t('Also send me emails', {
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
 * dashboard's card and in the bell (with "See all"), everything on its own
 * screen, in two tabs: "Active" (unread notifications, and what is still
 * assigned to me) and "Read". Assignments come from the current list, not
 * from their notifications, so that one done or taken back leaves the list.
 */
export const ForMeList = ({
  full = false,
  onOpen,
  emailSwitch = true,
  seeAll = true,
}: {
  full?: boolean;
  /** Called as an entry or "See all" is opened, e.g. to close a popup. */
  onOpen?: () => void;
  /** Without the email switch, for a popup keeping it below its scroll */
  emailSwitch?: boolean;
  /** Without "See all", for a popup showing it above its scroll */
  seeAll?: boolean;
}) => {
  const { t } = useTranslation();
  const { relativeDate } = useDate();
  const { untitledDocument } = useTrans();
  const textOf = useNotificationText();
  const targetOf = useNotificationTarget();
  const [tab, setTab] = useState<'active' | 'read'>('active');
  const readTab = full && tab === 'read';
  const { data: notifications = [], isLoading } = useNotifications(
    true,
    full ? (readTab ? 'read' : 'unread') : undefined,
  );
  const { data: assignedRows = [], isLoading: isAssignedLoading } =
    useAssignedRows(!readTab);
  // What is still assigned is active: never among the read
  const assigned = readTab ? [] : assignedRows;
  const { markRead, markAllRead } = useNotificationMutations();

  const entries = [
    ...notifications
      // Read assignments show as notifications: their row may be done
      .filter((notification) => readTab || notification.kind !== 'assignment')
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

  const empty =
    !isLoading && (readTab || !isAssignedLoading) && !entries.length;

  return (
    <>
      {/* The whole list can be long: its settings come first */}
      {full && (
        <Box
          $direction="row"
          $align="center"
          $justify="space-between"
          $gap="sm"
          $padding={{ horizontal: 'xs', bottom: 'xs' }}
          $css={css`
            flex-wrap: wrap;
            border-bottom: 1px solid
              var(--c--contextuals--border--surface--primary);
          `}
        >
          {emailSwitch && <EmailSwitch bare />}
          {!readTab && unreadCount > 0 && (
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
          )}
        </Box>
      )}
      {full && (
        <Box
          $direction="row"
          $gap="xs"
          $padding={{ horizontal: 'xs' }}
          role="tablist"
        >
          <Button
            size="small"
            role="tab"
            aria-selected={!readTab}
            variant={readTab ? 'tertiary' : 'primary'}
            onClick={() => setTab('active')}
          >
            {t('Active', {
              description:
                'Tab of the unread notifications and what is still assigned',
            })}
          </Button>
          <Button
            size="small"
            role="tab"
            aria-selected={readTab}
            variant={readTab ? 'primary' : 'tertiary'}
            onClick={() => setTab('read')}
          >
            {t('Read', { description: 'Tab of the read notifications' })}
          </Button>
        </Box>
      )}
      {!full && emailSwitch && <EmailSwitch />}
      {empty && (
        <Empty>
          {readTab
            ? t('No read notification yet.', {
                description: 'Empty Read tab of the notifications',
              })
            : full
              ? t('Nothing new: no unread notification, nothing assigned.', {
                  description: 'Empty Active tab of the notifications',
                })
              : t('No mentions or assignments yet.', {
                  description:
                    'Empty card of mentions, notifications and assignments',
                })}
        </Empty>
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
              href={`/page/${row.document.id}/#${row.anchor_id}`}
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
      {/* Always: the screen also holds the read ones */}
      {!full && seeAll && <SeeAll href={NOTIFICATIONS_HREF} onClick={onOpen} />}
    </>
  );
};
