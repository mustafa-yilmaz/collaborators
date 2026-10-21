import { Button } from '@gouvfr-lasuite/ui-components';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { AnchoredPanel } from '@/components/popover/AnchoredPanel';
import { useAuth } from '@/features/auth';

import { EmailSwitch, ForMeList } from './ForMeList';
import { useNotificationMutations, useUnreadCount } from './api';

/** The bell of the left panel: unread count and the notification inbox. */
export const NotificationBell = () => {
  const { t } = useTranslation();
  const { authenticated } = useAuth();
  const [opened, setOpened] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { data: unread } = useUnreadCount(authenticated);
  const { markAllRead } = useNotificationMutations();

  if (!authenticated) {
    return null;
  }

  const count = unread?.count ?? 0;

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
        // The size of the buttons beside it in the left panel
        $width="40px"
        $height="40px"
        $align="center"
        $justify="center"
        $css={css`
          border-radius: 4px;
          &:hover {
            background-color: var(
              --c--contextuals--background--semantic--contextual--primary
            );
          }
        `}
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
              top: 4px;
              right: 4px;
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
            $width="400px"
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
            {/* The summary of the dashboard's card, word for word */}
            <Box
              $gap="2xs"
              $padding={{ horizontal: '2xs', bottom: 'xs' }}
              $css="max-height: min(520px, 70vh); overflow-y: auto;"
            >
              <ForMeList onOpen={() => setOpened(false)} emailSwitch={false} />
            </Box>
            <Box $padding={{ horizontal: '2xs', bottom: 'xs' }}>
              <EmailSwitch />
            </Box>
          </Box>
        </AnchoredPanel>
      )}
    </>
  );
};
