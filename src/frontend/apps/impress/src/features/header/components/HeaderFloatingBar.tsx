import { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';

import { BoxType } from '@/components';
import { FadeComponent } from '@/components/Effect';
import { CardFloatingBar, FloatingBar } from '@/components/FloatingBar';
import { DocSearchButtonModal } from '@/features/docs/doc-search/components/DocSearchButtonModal';
import { LeftPanelCollapseButton } from '@/features/left-panel/components/LeftPanelCollapseButton';
import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { HeaderIcon } from './HeaderIcon';

export const HeaderFloatingBar = (props: PropsWithChildren<BoxType>) => {
  const { isMobile } = useResponsiveStore();
  const { t } = useTranslation();
  const { isPanelOpen } = useLeftPanelStore();

  // The logo and the search come here while the side panel is hidden
  const isVisible = !isPanelOpen || isMobile;

  return (
    <FloatingBar $align="center" {...props}>
      <LeftPanelCollapseButton
        ariaLabel={
          isPanelOpen
            ? t('Hide the side panel', {
                description:
                  'Accessible name of the button hiding the left panel',
              })
            : t('Show the side panel', {
                description:
                  'Accessible name of the button showing the left panel',
              })
        }
      />
      <FadeComponent isVisible={isVisible}>
        <HeaderIcon />
      </FadeComponent>
      <FadeComponent isVisible={isVisible}>
        <CardFloatingBar>
          <DocSearchButtonModal size="small" color="neutral" />
        </CardFloatingBar>
      </FadeComponent>
    </FloatingBar>
  );
};
