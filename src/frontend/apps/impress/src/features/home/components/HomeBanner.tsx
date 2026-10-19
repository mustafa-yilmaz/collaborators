import { Button } from '@gouvfr-lasuite/ui-components';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { css, keyframes } from 'styled-components';

import { Box, Icon, Text } from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';
import { ProConnectButton, gotoLogin } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

const rise = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
`;

/** Elements of the cover come in one after the other, unless motion is off. */
const entrance = (delayMs: number) => css`
  animation: ${rise} 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms both;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

export default function HomeBanner() {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();
  const { data: config } = useConfig();
  const withProConnect = config?.theme_customization?.home?.['with-proconnect'];
  const icon = config?.theme_customization?.home?.['icon-banner'];

  return (
    <Box
      $maxWidth="78rem"
      $width="100%"
      $justify="center"
      $align="center"
      $height="100%"
      $padding={{ vertical: 'md' }}
      $position="relative"
      className="--docs--home-banner"
      $css={css`
        isolation: isolate;
        /* A soft glow in the brand colours and a faint dot pattern, behind */
        &::before {
          content: '';
          position: absolute;
          inset: -10% -20%;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(
              40% 50% at 22% 45%,
              color-mix(
                in srgb,
                var(--c--globals--colors--brand-400) 16%,
                transparent
              ),
              transparent 70%
            ),
            radial-gradient(
              35% 45% at 78% 55%,
              color-mix(
                in srgb,
                var(--c--globals--colors--brand-200, #c9c5f5) 30%,
                transparent
              ),
              transparent 70%
            );
        }
        &::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-image: radial-gradient(
            color-mix(
                in srgb,
                var(--c--globals--colors--brand-400) 22%,
                transparent
              )
              1px,
            transparent 1px
          );
          background-size: 22px 22px;
          mask-image: radial-gradient(60% 60% at 50% 50%, black, transparent);
        }
      `}
    >
      <Box
        $width="100%"
        $justify="center"
        $align="center"
        $position="relative"
        $direction={!isMobile ? 'row' : 'column'}
        $gap={!isMobile ? '4.5rem' : '1.5rem'}
        $height="100%"
        $padding={{ horizontal: !isMobile ? 'lg' : 'none' }}
      >
        <Box
          $width={!isMobile ? '50%' : '100%'}
          $justify="center"
          $align={!isMobile ? 'flex-start' : 'center'}
          $gap="1.25rem"
          // Its own width: the logo never runs into the illustration
          $css={css`
            min-width: 0;
          `}
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
              $size={isMobile ? '2rem' : 'clamp(2rem, 0.9rem + 2.2vw, 3rem)'}
              $weight="bold"
              $css={css`
                letter-spacing: -0.01em;
                ${entrance(0)}
              `}
            />
          )}
          <Text
            as="h2"
            $size={!isMobile ? '1.4rem' : '1.15rem'}
            $weight="400"
            $textAlign={!isMobile ? 'left' : 'center'}
            $margin="none"
            $variation="secondary"
            $css={css`
              line-height: 1.45;
              ${entrance(120)}
              span {
                display: block;
              }
            `}
          >
            {/* Two rows: what it is, then what for */}
            <span>
              {t('Collaborative proposal idea development', {
                description: 'Main headline of the home page, first row',
              })}
            </span>
            <span>
              {t('for projects', {
                description: 'Main headline of the home page, second row',
              })}
            </span>
          </Text>
          <Box
            $margin={{ top: '0.5rem' }}
            $css={css`
              ${entrance(240)}
              .c__button {
                padding-inline: 1.4rem;
                min-height: 3rem;
                font-size: 1rem;
                box-shadow: 0 8px 22px
                  color-mix(
                    in srgb,
                    var(--c--globals--colors--brand-500, #4f46e5) 28%,
                    transparent
                  );
                transition:
                  transform 0.15s ease,
                  box-shadow 0.15s ease;
              }
              .c__button:hover {
                transform: translateY(-1px);
                box-shadow: 0 12px 28px
                  color-mix(
                    in srgb,
                    var(--c--globals--colors--brand-500, #4f46e5) 34%,
                    transparent
                  );
              }
            `}
          >
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
        </Box>
        {!isMobile && (
          <Box
            $width="50%"
            $align="center"
            $justify="center"
            $css={css`
              min-height: 0;
              max-height: 100%;
              ${entrance(180)}
            `}
          >
            {/* The illustration, in a soft frame, floating gently */}
            <Box
              $padding="1.5rem"
              $width="100%"
              $maxWidth="520px"
              $css={css`
                border-radius: 28px;
                background: color-mix(
                  in srgb,
                  var(--c--contextuals--background--surface--primary, #fff) 70%,
                  transparent
                );
                border: 1px solid
                  color-mix(
                    in srgb,
                    var(--c--globals--colors--brand-400) 18%,
                    transparent
                  );
                box-shadow: 0 24px 60px -24px
                  color-mix(
                    in srgb,
                    var(--c--globals--colors--brand-500, #4f46e5) 35%,
                    transparent
                  );
                backdrop-filter: blur(6px);
                max-height: 100%;
                animation: ${float} 7s ease-in-out infinite;
                @media (prefers-reduced-motion: reduce) {
                  animation: none;
                }
              `}
            >
              <Image
                src="/assets/home-collaborators.svg"
                alt={t('Banner image', {
                  description: 'Alt text of the home page banner',
                })}
                width={560}
                height={420}
                priority
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: 'min(380px, 52vh)',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
