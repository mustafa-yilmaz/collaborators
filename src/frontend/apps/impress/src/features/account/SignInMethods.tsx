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
import { MergeProposal } from './MergeAccounts';
import {
  AddedAccountNotice,
  useAddSignInAccount,
  useDisconnectSignInMethod,
  useRemoveSignInAccount,
  useSignInMethods,
} from './api';

/** What happened to the account just added, said once. */
const AddedNotice = ({ notice }: { notice: AddedAccountNotice }) => {
  const { t } = useTranslation();
  const values = {
    provider: PROVIDER_NAMES[notice.provider] ?? notice.provider,
    account: notice.account,
  };
  return (
    <Text
      role="status"
      $size="sm"
      $theme={notice.outcome === 'added' ? 'success' : undefined}
    >
      {notice.outcome === 'added'
        ? t('{{account}} now signs you in here too.', {
            description: 'Another account was added to sign in',
            ...values,
          })
        : notice.outcome === 'already'
          ? t('{{account}} was already connected.', {
              description: 'The account added was already connected',
              ...values,
            })
          : [
              t(
                '{{account}} already opens a separate Collaborators account, so it wasn’t added.',
                {
                  description: 'The account added has its own account',
                  ...values,
                },
              ),
              notice.reason,
            ]
              .filter(Boolean)
              .join(' ')}
    </Text>
  );
};

/**
 * The providers a collaborator signs in with: each one connected (with the
 * account it's connected to, and more Google or Microsoft accounts added)
 * or not. Connecting asks to sign in with it once; disconnecting is never
 * possible for the last way in.
 */
export const SignInMethods = () => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSignInMethods();
  const disconnect = useDisconnectSignInMethod();
  const addAccount = useAddSignInAccount();
  const removeAccount = useRemoveSignInAccount();
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
    data.methods.reduce(
      (count, method) =>
        count + (method.connected ? 1 : 0) + method.more_accounts.length,
      0,
    ) + (data.has_password ? 1 : 0);

  return (
    <Box $gap="sm">
      {/* A merge offered says it in its own box */}
      {data.notice && data.notice.outcome !== 'merge' && (
        <AddedNotice notice={data.notice} />
      )}
      <MergeProposal />
      {hasUnconnectedProviders(data) && (
        <HintCard icon="warning" tone="warning" testId="hint-connect-accounts">
          <ConnectAccountsText onSignInMethodsPage />
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
              $gap="xs"
              $padding={{ horizontal: 'sm', vertical: 'xs' }}
              data-testid={`sign-in-method-${method.provider}`}
            >
              <Box
                $direction="row"
                $align="center"
                $justify="space-between"
                $gap="sm"
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
                    icon={
                      <Icon iconName="link" $size="18px" $color="inherit" />
                    }
                    onClick={() => gotoConnectProvider(method.provider)}
                  >
                    {t('Connect', {
                      description: 'Button connecting a sign-in method',
                    })}
                  </Button>
                )}
              </Box>
              {method.more_accounts.map((account) => (
                <Box
                  key={account.id}
                  $direction="row"
                  $align="center"
                  $justify="space-between"
                  $gap="sm"
                  $padding={{ left: 'xl' }}
                  data-testid={`sign-in-account-${account.id}`}
                >
                  <Text $size="sm" $variation="secondary" $ellipsis>
                    {t('Also connected: {{account}}', {
                      description: 'Another account of a sign-in method',
                      account: account.account,
                    })}
                  </Text>
                  <Button
                    size="small"
                    variant="secondary"
                    color="error"
                    disabled={removeAccount.isPending}
                    onClick={() =>
                      removeAccount.mutate({
                        provider: method.provider,
                        id: account.id,
                      })
                    }
                  >
                    {t('Disconnect', {
                      description: 'Button disconnecting a sign-in method',
                    })}
                  </Button>
                </Box>
              ))}
              {method.can_add_accounts && (
                <Box $direction="row" $padding={{ left: 'xl' }}>
                  <Button
                    size="small"
                    variant="tertiary"
                    disabled={addAccount.isPending}
                    icon={<Icon iconName="add" $size="18px" $color="inherit" />}
                    onClick={() => addAccount.mutate(method.provider)}
                  >
                    {t('Add another {{provider}} account', {
                      description:
                        'Button adding one more account of a provider',
                      provider: name,
                    })}
                  </Button>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {(addAccount.error ?? removeAccount.error) && (
        <Text $size="sm" $theme="error" role="alert">
          {(addAccount.error ?? removeAccount.error)?.cause?.[0]}
        </Text>
      )}
      {disconnect.error && (
        <Text $size="sm" $theme="error" role="alert">
          {disconnect.error.cause?.[0]}
        </Text>
      )}
      <Text $size="sm" $variation="secondary">
        {t(
          'Connecting a method asks you to sign in with it once. Then any connected method signs you in to this same account. You can add several Google and Microsoft accounts: their account chooser lets you pick which one. If one you add already has its own Collaborators account, you can merge it into this one.',
          { description: 'Explanation on the sign-in methods page' },
        )}
      </Text>
    </Box>
  );
};
