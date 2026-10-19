import { Button } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Loading, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { gotoConnectProvider } from '@/features/auth';
import { ProviderLogo } from '@/features/signin/ProviderLogo';
import { PROVIDER_NAMES } from '@/features/signin/SignIn';

import {
  ConnectAccountsText,
  HintCard,
  hasUnconnectedProviders,
} from './AccountHints';
import { useDisconnectSignInMethod, useSignInMethods } from './api';

/**
 * The providers a collaborator signs in with: each one connected (with the
 * account it's connected to) or not. Connecting asks to sign in with it once;
 * disconnecting is never possible for the last way in.
 */
export const SignInMethods = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSignInMethods();
  const disconnect = useDisconnectSignInMethod();
  const { data: config } = useConfig();

  if (isLoading) {
    return <Loading />;
  }

  const accountUrl = config?.COLLABORATORS_ACCOUNT_URL;
  if (!data) {
    return (
      <Box $gap="xs">
        <Text $variation="secondary">
          {error?.cause?.[0] ??
            t("Your sign-in methods can't be shown right now.", {
              description: 'Sign-in methods page, when they cannot be read',
            })}
        </Text>
        {accountUrl && (
          <StyledLink href={accountUrl} target="_blank" rel="noopener">
            <Text $theme="brand">
              {t('Manage them on the sign-in server', {
                description: 'Link to the identity server account page',
              })}
            </Text>
          </StyledLink>
        )}
      </Box>
    );
  }

  const connectedCount =
    data.methods.filter((method) => method.connected).length +
    (data.has_password ? 1 : 0);

  return (
    <Box $gap="sm">
      {hasUnconnectedProviders(data) && (
        <HintCard icon="warning" tone="warning" testId="hint-connect-accounts">
          <ConnectAccountsText />
        </HintCard>
      )}
      <Box
        as="ul"
        $css={css`
          list-style: none;
          margin: 0;
          padding: 0;
          border: 1px solid var(--c--contextuals--border--surface--primary);
          border-radius: var(--c--globals--spacings--xs);
          & > li + li {
            border-top: 1px solid
              var(--c--contextuals--border--surface--primary);
          }
        `}
      >
        {data.methods.map((method) => {
          const name = PROVIDER_NAMES[method.provider] ?? method.provider;
          const isLast = method.connected && connectedCount <= 1;
          return (
            <Box
              as="li"
              key={method.provider}
              $direction="row"
              $align="center"
              $justify="space-between"
              $gap="sm"
              $padding={{ horizontal: 'sm', vertical: 'xs' }}
              data-testid={`sign-in-method-${method.provider}`}
            >
              <Box
                $direction="row"
                $align="center"
                $gap="sm"
                $css="min-width: 0;"
              >
                <ProviderLogo provider={method.provider} size={24} />
                <Box $gap="4xs" $css="min-width: 0;">
                  <Text $weight="600">{name}</Text>
                  <Text $size="sm" $variation="secondary" $ellipsis>
                    {method.connected
                      ? method.account
                        ? t('Connected: {{account}}', {
                            description: 'A connected sign-in method',
                            account: method.account,
                          })
                        : t('Connected', {
                            description: 'A connected sign-in method',
                          })
                      : t('Not connected', {
                          description: 'A sign-in method not connected',
                        })}
                  </Text>
                </Box>
              </Box>
              {method.connected ? (
                <Button
                  size="small"
                  variant="secondary"
                  color={isLast ? 'neutral' : 'error'}
                  disabled={isLast || disconnect.isPending}
                  title={
                    isLast
                      ? t("Your only way to sign in can't be disconnected.", {
                          description:
                            'Why the last sign-in method cannot be disconnected',
                        })
                      : undefined
                  }
                  onClick={() => disconnect.mutate(method.provider)}
                >
                  {t('Disconnect', {
                    description: 'Button disconnecting a sign-in method',
                  })}
                </Button>
              ) : (
                <Button
                  size="small"
                  icon={<Icon iconName="link" $size="18px" $color="inherit" />}
                  onClick={() => gotoConnectProvider(method.provider)}
                >
                  {t('Connect', {
                    description: 'Button connecting a sign-in method',
                  })}
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
      {disconnect.error && (
        <Text $size="sm" $theme="error" role="alert">
          {disconnect.error.cause?.[0]}
        </Text>
      )}
      <Text $size="sm" $variation="secondary">
        {t(
          'Connecting a method asks you to sign in with it once. Then any connected method signs you in to this same account.',
          { description: 'Explanation on the sign-in methods page' },
        )}
      </Text>
    </Box>
  );
};
