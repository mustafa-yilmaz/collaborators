import { DotLottie, DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useEffect, useState } from 'react';
import { css } from 'styled-components';

import { Box } from '@/components/Box';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';

import { useHideOnScroll } from '../hooks/useHideOnScroll';

export const HeaderIcon = () => {
  const isVisible = useHideOnScroll();
  const { data: config } = useConfig();
  const wordmark = config?.theme_customization?.wordmark;
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);

  useEffect(() => {
    if (isVisible && dotLottie) {
      dotLottie.play();
    }
  }, [isVisible, dotLottie]);

  return (
    <Box
      $width={wordmark ? 'auto' : '32px'}
      $height="32px"
      $justify="center"
      $css={css`
        transition: transform 0.3s ease-in-out;
        ${
          isVisible
            ? css`
                transform: translateY(0);
              `
            : css`
                transform: translateY(-300%);
              `
        }
      `}
    >
      {wordmark ? (
        <Title as="span" $size="1.25rem" />
      ) : (
        <DotLottieReact
          src="/assets/Docs-lottie.json"
          autoplay={false}
          loop={false}
          dotLottieRefCallback={setDotLottie}
          aria-label="Docs animated icon"
        />
      )}
    </Box>
  );
};
