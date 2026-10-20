import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box } from '@/components';
import { Footer } from '@/features/footer';
import { MAIN_LAYOUT_ID } from '@/layouts/conf';
import { useResponsiveStore } from '@/stores';

import HomeBanner from './HomeBanner';
import { HomeHeader, getHeaderHeight } from './HomeHeader';

export function HomeContent() {
  const { t } = useTranslation();
  const { isMobile, isSmallMobile } = useResponsiveStore();

  return (
    <Box
      as="main"
      role="main"
      id={MAIN_LAYOUT_ID}
      tabIndex={-1}
      className="--docs--home-content"
      aria-label={t('Main content', {
        description: 'Accessible name of the main area of the page',
      })}
      $css={css`
        &:focus {
          outline: 3px solid var(--c--globals--colors--primary-600);
          outline-offset: -3px;
        }
        &:focus:not(:focus-visible) {
          outline: none;
        }
      `}
    >
      <HomeHeader />
      <Box
        $css={css`
          height: calc(100vh - ${getHeaderHeight(isSmallMobile)}px);
          overflow-y: auto;
          /* the cover's glow reaches past a phone's edges: no sideways scroll */
          ${isMobile && 'overflow-x: hidden;'}
        `}
      >
        {/* The cover fills the screen above the footer, without scrolling */}
        <Box
          $align="center"
          $justify="center"
          $maxWidth="1120px"
          $padding={{ horizontal: isSmallMobile ? '1rem' : '3rem' }}
          $width="100%"
          $margin={{ horizontal: 'auto' }}
          $css={css`
            flex: 1 1 auto;
            min-height: 0;
          `}
        >
          <HomeBanner />
        </Box>
        <Footer />
      </Box>
    </Box>
  );
}
