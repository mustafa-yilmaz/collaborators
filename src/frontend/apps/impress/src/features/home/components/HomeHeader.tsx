import Image from 'next/image';

import { Box } from '@/components';
import { Title } from '@/components/Title';
import { Waffle } from '@/components/Waffle';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { LanguagePickerLegacy } from '@/features/language';
import { useResponsiveStore } from '@/stores';

export const HEADER_HEIGHT = 91;
export const HEADER_HEIGHT_MOBILE = 52;

export const getHeaderHeight = (isSmallMobile: boolean) =>
  isSmallMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT;

export const HomeHeader = () => {
  const { spacingsTokens } = useCunninghamTheme();
  const { isSmallMobile } = useResponsiveStore();
  const { data: config } = useConfig();

  const icon = config?.theme_customization?.header?.icon;
  const logo = config?.theme_customization?.header?.logo;
  const singleLanguage = config?.theme_customization?.single_language;
  const wordmark = config?.theme_customization?.wordmark;

  return (
    <Box
      $direction="row"
      $justify="space-between"
      as="header"
      $align="center"
      $width="100%"
      $padding={{ horizontal: 'small' }}
      $height={`${isSmallMobile ? HEADER_HEIGHT_MOBILE : HEADER_HEIGHT}px`}
      className="--docs--home-header"
    >
      <Box
        $align="center"
        $gap="2rem"
        $direction="row"
        $width="auto"
        $justify="center"
      >
        {!isSmallMobile && logo?.src && (
          <Image
            priority
            width={0}
            height={0}
            style={{ width: logo.width, height: 'auto' }}
            {...logo}
          />
        )}
        <Box
          $align="center"
          $gap={spacingsTokens['3xs']}
          $direction="row"
          $position="relative"
          $height="fit-content"
        >
          {icon?.src && (
            <Image
              data-testid="header-icon-docs"
              width={0}
              height={0}
              style={{
                width: icon.width,
                height: icon.height,
              }}
              priority
              {...(({ withTitle: _, ...rest }) => rest)(icon)}
            />
          )}
          {/* With a text wordmark, the home banner already shows it */}
          {!wordmark && (!icon?.src || icon.withTitle) && <Title />}
        </Box>
      </Box>
      <Box
        $direction="row"
        $gap={!isSmallMobile ? '1rem' : undefined}
        $align="center"
      >
        {!singleLanguage && <LanguagePickerLegacy />}
        <Waffle />
      </Box>
    </Box>
  );
};
