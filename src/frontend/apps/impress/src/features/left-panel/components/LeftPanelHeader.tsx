import { useTranslation } from 'react-i18next';

import {
  Box,
  ButtonCloseModal,
  ButtonLink,
  SeparatedSection,
} from '@/components';
import { NewDocButton } from '@/docs/doc-management/components/NewDocButton';
import { DocSearchButtonModal } from '@/docs/doc-search/components/DocSearchButtonModal';
import { useAuth } from '@/features/auth';
import { HEADER_ROW_MIN_HEIGHT, HeaderLogoLink } from '@/features/header';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import HomeSVG from '@/icons/house-rounded.svg';
import { useResponsiveStore } from '@/stores';

import { useLeftPanelStore } from '../stores';

export const LeftPanelHeader = () => {
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();

  return (
    <Box $width="100%" className="--docs--left-panel-header">
      <Box
        $padding={{ horizontal: 'xs' }}
        $direction="row"
        $align="center"
        $gap="2xs"
        $minHeight={HEADER_ROW_MIN_HEIGHT}
      >
        <HeaderLogoLink headingLevel="h1" />
        {isMobile && (
          <Box $margin={{ left: 'auto' }}>
            <ButtonCloseModal
              onClick={closePanel}
              aria-label="Close left panel"
            />
          </Box>
        )}
      </Box>
      <LeftPanelHeaderActions />
    </Box>
  );
};
export const LeftPanelHeaderActions = () => {
  const { authenticated } = useAuth();
  const { togglePanel, closePanel } = useLeftPanelStore();
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();

  const onHomeClick = () => {
    if (isMobile) {
      togglePanel();
    }
  };

  return (
    <SeparatedSection>
      <Box
        $padding={{ horizontal: 'sm' }}
        $width="100%"
        $direction="row"
        $justify="space-between"
        $align="center"
      >
        {authenticated && (
          <NewDocButton onClose={() => isMobile && closePanel()} />
        )}
        <Box
          $direction="row"
          $align="center"
          $gap="2px"
          $margin={{ left: 'auto' }}
        >
          {/* Collaborators: on every screen, so the buttons keep their place */}
          <ButtonLink
            href="/"
            data-testid="home-button"
            onClick={onHomeClick}
            aria-label={t('Back to homepage', {
              description:
                'Accessible name of the button going back to the home page',
            })}
            size="medium"
            color="brand"
            variant="tertiary"
            icon={<HomeSVG aria-hidden="true" width={24} height={24} />}
          />
          <NotificationBell />
          <DocSearchButtonModal />
        </Box>
      </Box>
    </SeparatedSection>
  );
};
