import { Button } from '@gouvfr-lasuite/ui-components';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';
import { useCunninghamTheme } from '@/cunningham';
import { ProConnectButton, gotoLogin } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

export default function HomeBanner() {
  const { t } = useTranslation();
  const { spacingsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const { data: config } = useConfig();
  const withProConnect = config?.theme_customization?.home?.['with-proconnect'];
  const icon = config?.theme_customization?.home?.['icon-banner'];

  return (
    <Box
      $maxWidth="78rem"
      $width="100%"
      $justify="space-around"
      $align="center"
      $height="100%"
      $padding={{ vertical: 'md' }}
      $position="relative"
      className="--docs--home-banner"
    >
      <Box
        $width="100%"
        $justify="center"
        $align="center"
        $position="relative"
        $direction={!isMobile ? 'row' : 'column'}
        $gap="1rem"
        $height="100%"
      >
        <Box
          $width={!isMobile ? '50%' : '100%'}
          $justify="center"
          $align="center"
          $gap={spacingsTokens['sm']}
        >
          {icon?.src && (
            <Image
              data-testid="header-icon-docs"
              width={0}
              height={0}
              style={{
                width: '64px',
                height: 'auto',
              }}
              priority
              {...icon}
            />
          )}
          {!icon?.src && (
            <Title
              as="span"
              $size={isMobile ? '1.75rem' : '2.5rem'}
              $weight="bold"
            />
          )}
          <Text
            as="h2"
            $size={!isMobile ? '1.5rem' : '1.25rem'}
            $weight="400"
            $textAlign="center"
            $margin="none"
            $variation="secondary"
            $css={css`
              line-height: 1.35;
            `}
          >
            {t('Collaborative proposal idea development for projects', {
              description: 'Main headline of the home page',
            })}
          </Text>
          {withProConnect ? (
            <ProConnectButton />
          ) : (
            <Button
              onClick={() => gotoLogin()}
              icon={<Icon iconName="bolt" $color="white" />}
            >
              {t('Start collaborating', {
                description: 'Call-to-action button of the home page',
              })}
            </Button>
          )}
        </Box>
        {!isMobile && (
          <Image
            src="/assets/home-collaborators.svg"
            alt={t('Banner image', {
              description: 'Alt text of the home page banner',
            })}
            width={560}
            height={420}
            priority
            style={{
              width: 'auto',
              maxWidth: '50%',
              height: 'auto',
              maxHeight: 'min(420px, 100%)',
            }}
          />
        )}
      </Box>
    </Box>
  );
}
