import { Button } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Loading, Text } from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';
import { getAuthUrl, gotoProviderLogin, useAuth } from '@/features/auth';
import { Footer } from '@/features/footer';
import { useResponsiveStore } from '@/stores';

/** How each identity provider is named on its button. */
export const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  linkedin: 'LinkedIn',
  x: 'X',
};

/**
 * The sign-in page: one button per identity provider, each going straight to
 * that provider. Signing in for the first time creates the account; there is
 * no password, nor any sign-up form.
 */
export const SignIn = () => {
  const { t } = useTranslation();
  const { authenticated, isAuthLoading } = useAuth();
  const { data: config, isFetched } = useConfig();
  const { replace } = useRouter();
  const { isSmallMobile } = useResponsiveStore();
  const providers = config?.COLLABORATORS_SIGNIN_PROVIDERS ?? [];
  const withPassword = !!config?.COLLABORATORS_SIGNIN_PASSWORD;

  // Already signed in: go on to where they were heading
  useEffect(() => {
    if (authenticated) {
      void replace(getAuthUrl() ?? '/');
    }
  }, [authenticated, replace]);

  if (isAuthLoading || authenticated || !isFetched) {
    return <Loading $height="100vh" $width="100vw" />;
  }

  return (
    <Box
      as="main"
      $height="100vh"
      $css="overflow-y: auto;"
      className="--collaborators--signin"
    >
      <Box
        $flex={1}
        $align="center"
        $justify="center"
        $gap="lg"
        $padding={{ horizontal: isSmallMobile ? 'sm' : 'lg', vertical: 'lg' }}
      >
        <Box $align="center" $gap="xs">
          <Title
            headingLevel="h1"
            $size={isSmallMobile ? '1.8rem' : '2.6rem'}
          />
          <Text
            as="h2"
            $size="lg"
            $weight="400"
            $margin="none"
            $textAlign="center"
          >
            {t('Sign in to start collaborating', {
              description: 'Heading of the sign-in page',
            })}
          </Text>
        </Box>
        <Box $gap="xs" $width="100%" $maxWidth="340px">
          {providers.map((provider) => (
            <Button
              key={provider}
              fullWidth
              variant="secondary"
              onClick={() => gotoProviderLogin(provider)}
              data-testid={`signin-${provider}`}
            >
              {t('Continue with {{provider}}', {
                description: 'Button signing in with an identity provider',
                provider: PROVIDER_NAMES[provider] ?? provider,
              })}
            </Button>
          ))}
          {withPassword && (
            <Box $gap="3xs" $margin={{ top: providers.length ? 'xs' : 'none' }}>
              <Button
                fullWidth
                variant="tertiary"
                onClick={() => gotoProviderLogin()}
                data-testid="signin-password"
              >
                {t('Use a test account', {
                  description:
                    'Button signing in with a development account and password',
                })}
              </Button>
              <Text $size="xs" $variation="secondary" $textAlign="center">
                {t(
                  'Development only: the accounts of the local identity server.',
                  {
                    description: 'Explains the test account button',
                  },
                )}
              </Text>
            </Box>
          )}
          {!providers.length && !withPassword && (
            <Text $variation="secondary" $textAlign="center">
              {t('Sign-in is not set up yet.', {
                description: 'Sign-in page without any provider',
              })}
            </Text>
          )}
        </Box>
        <Text
          $size="sm"
          $variation="secondary"
          $textAlign="center"
          $maxWidth="420px"
          $css={css`
            line-height: 1.5;
          `}
        >
          {t(
            'No password to remember: an account you already have signs you in. The first time, it creates your Collaborators account.',
            { description: 'Explanation under the sign-in buttons' },
          )}
        </Text>
      </Box>
      <Footer />
    </Box>
  );
};
