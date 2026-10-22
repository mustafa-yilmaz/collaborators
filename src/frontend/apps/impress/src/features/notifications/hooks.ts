import { useTranslation } from 'react-i18next';

import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';

import { Notification } from './api';

/**
 * Where a notification leads: its place in a document, or, for joining, the
 * workspace's settings (a request to answer) or the workspace (let in).
 */
export const useNotificationTarget = () => {
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  return (notification: Notification) => {
    // Someone registered: platform administrators decide there
    if (notification.kind === 'signup') {
      return { href: '/registrations/' };
    }
    if (notification.kind === 'signup_approved') {
      return { href: '/' };
    }
    if (notification.kind === 'join_request' && notification.workspace) {
      return { href: `/workspaces/${notification.workspace.id}/settings/` };
    }
    if (notification.kind === 'join_approved' && notification.workspace) {
      const workspaceId = notification.workspace.id;
      return {
        href: `/workspace/${workspaceId}/`,
        beforeOpen: () => setCurrentWorkspaceId(workspaceId),
      };
    }
    const anchor = notification.anchor_id ? `#${notification.anchor_id}` : '';
    return { href: `/page/${notification.document?.id}/${anchor}` };
  };
};

/** The icon of a notification, by its kind. */
export const notificationIcon = (notification: Notification) =>
  ({
    assignment: 'assignment_ind',
    comment_mention: 'chat',
    join_request: 'person_add',
    join_approved: 'how_to_reg',
    signup: 'person_add',
    signup_approved: 'celebration',
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
    if (notification.kind === 'signup') {
      return t('{{name}} registered and waits for your approval', {
        description: 'Notification of a new registration to approve',
        name,
      });
    }
    if (notification.kind === 'signup_approved') {
      return t('{{name}} accepted your registration: welcome!', {
        description: 'Notification of an accepted registration',
        name,
      });
    }
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
      t('Untitled page', { description: 'Name of a doc without title' });
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
