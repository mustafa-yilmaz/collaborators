import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { mirroredCss, useLeftPanelStore, useSidebarSide } from '../stores';

import { LeftPanelContent } from './LeftPanelContent';
import { LeftPanelFooter } from './LeftPanelFooter';
import { LeftPanelHeader } from './LeftPanelHeader';

export const LeftPanel = ({ isResizable }: { isResizable?: boolean }) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();
  const { isPanelOpen, closePanel } = useLeftPanelStore();
  // Collaborators: on the right, the panel is its own mirror image
  const { isRight } = useSidebarSide();

  return (
    <>
      {isMobile && (
        <Box
          $css={css`
            position: fixed;
            inset: 0;
            z-index: 999;
            background-color: rgba(0, 0, 0, 0.3);
            transition: opacity 0.2s ease-in-out;
            opacity: ${isPanelOpen ? 1 : 0};
            pointer-events: ${isPanelOpen ? 'auto' : 'none'};
          `}
          onClick={closePanel}
        />
      )}
      <Box
        as="nav"
        className="--docs--left-panel"
        data-testid="left-panel"
        aria-label={t('Left panel', {
          description: 'Accessible name of the left navigation panel',
        })}
        // Collaborators: 260px, the width of the resizable panel too
        $width={isResizable ? '100%' : '260px'}
        $height="100dvh"
        $overflow="hidden"
        $css={css`
          ${isRight ? mirroredCss : ''}
          z-index: 1;
          background-color: var(--c--contextuals--background--surface--primary);
          transition:
            transform 0.2s ease-in-out,
            width 0.2s ease-in-out;

          ${
            !isResizable
              ? css`
                  border-inline-end: 1px solid
                    var(--c--contextuals--border--surface--primary);
                `
              : ''
          }

          ${
            // Collaborators: the panel can be hidden at every width; the
            // resizable one (on documents) collapses itself
            !isResizable && !isMobile
              ? css`
                  ${
                    !isPanelOpen
                      ? css`
                          transform: translateX(${isRight ? '100%' : '-100%'});
                          width: 0;
                        `
                      : ''
                  }
                `
              : ''
          }

          ${
            isMobile
              ? css`
                  box-shadow: ${isRight ? '-10px' : '10px'} 0px 10px 0px
                    rgba(0, 0, 0, 0.05);
                  position: fixed;
                  z-index: 1000;
                  top: 0;
                  ${isRight ? 'right' : 'left'}: 0;
                  ${
                    !isPanelOpen
                      ? css`
                          transform: translateX(${isRight ? '100%' : '-100%'});
                          width: 0;
                        `
                      : ''
                  }
                `
              : ''
          }
        `}
      >
        <Box
          $css={css`
            flex: 0 0 auto;
          `}
        >
          <LeftPanelHeader />
        </Box>
        <LeftPanelContent />
        <LeftPanelFooter />
      </Box>
    </>
  );
};
