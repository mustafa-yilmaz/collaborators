import { Button } from '@gouvfr-lasuite/ui-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { useConfig } from '@/core';
import { useAuth } from '@/features/auth';

import {
  Hint,
  SignInMethods,
  useDismissHint,
  useHints,
  useSignInMethods,
} from './api';

export const SIGN_IN_METHODS_PATH = '/account/sign-in-methods/';

/**
 * Whether only one provider is connected while others are offered: signing
 * in with another one, under another email, would make a separate account.
 */
export const hasUnconnectedProviders = (methods?: SignInMethods) => {
  const connected = methods?.methods.filter((method) => method.connected);
  return (
    !!methods &&
    connected?.length === 1 &&
    connected.length < methods.methods.length
  );
};

/** A bordered note: informative, or a yellow warning. */
export const HintCard = ({
  icon,
  testId,
  tone = 'info',
  children,
  actions,
  onClose,
  closeLabel,
}: {
  icon: string;
  testId: string;
  tone?: 'info' | 'warning';
  children: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) => (
  <Box
    role="note"
    data-testid={testId}
    $direction="row"
    $gap="sm"
    $padding={{ horizontal: 'sm', vertical: 'xs' }}
    $css={
      tone === 'warning'
        ? css`
            border: 1px solid
              var(--c--contextuals--border--semantic--warning--secondary);
            border-radius: var(--c--globals--spacings--xs);
            background: var(
              --c--contextuals--background--semantic--warning--tertiary
            );
          `
        : css`
            border: 1px solid var(--c--contextuals--border--surface--primary);
            border-radius: var(--c--globals--spacings--xs);
            background: var(
              --c--contextuals--background--semantic--contextual--primary
            );
          `
    }
  >
    <Icon
      iconName={icon}
      $size="22px"
      $theme={tone === 'warning' ? 'warning' : 'brand'}
      $css="margin-top: 2px;"
    />
    <Box $flex={1} $gap="xs" $css="min-width: 0;">
      {children}
      {actions && (
        <Box $direction="row" $gap="xs" $css="flex-wrap: wrap;">
          {actions}
        </Box>
      )}
    </Box>
    {onClose && (
      <BoxButton
        aria-label={closeLabel}
        title={closeLabel}
        $padding="3xs"
        $css="align-self: flex-start;"
        onClick={onClose}
      >
        <Icon iconName="close" $size="18px" $variation="secondary" />
      </BoxButton>
    )}
  </Box>
);

/** The warning about unconnected sign-in methods, on its own words. */
export const ConnectAccountsText = () => {
  const { t } = useTranslation();
  return (
    <>
      <Text $weight="600">
        {t('Your other accounts are not connected yet', {
          description: 'Warning that only one sign-in method is connected',
        })}
      </Text>
      <Text $size="sm">
        {t(
          'Do you also sign in with another Google, Microsoft or LinkedIn account? Connect it so it opens this same account, even if its email is different. Otherwise it would make a separate account.',
          { description: 'Hint to connect other sign-in methods' },
        )}
      </Text>
    </>
  );
};

/** A button-looking link to the sign-in methods page. */
const SignInMethodsLink = ({
  label,
  primary,
}: {
  label: string;
  primary?: boolean;
}) => (
  <StyledLink href={SIGN_IN_METHODS_PATH}>
    <Button
      size="small"
      variant={primary ? 'primary' : 'secondary'}
      tabIndex={-1}
    >
      {label}
    </Button>
  </StyledLink>
);

/**
 * Dashboard hints about signing in, one at a time and closed for good:
 * - a new account is welcomed, in case the person already has another one
 *   (signed in with another provider and email, it is a separate account);
 * - someone signing in with a single provider is warned and offered to
 *   connect the others, so all of them open this same account.
 */
export const AccountHints = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: config } = useConfig();
  const { data: hints } = useHints();
  const dismiss = useDismissHint();
  const providers = config?.COLLABORATORS_SIGNIN_PROVIDERS ?? [];
  const dismissed = (hint: Hint) => !!hints?.dismissed.includes(hint);
  const showWelcome = !!hints && !dismissed('welcome');
  const { data: methods } = useSignInMethods(
    !!hints &&
      !showWelcome &&
      !dismissed('connect-accounts') &&
      providers.length > 1,
  );

  if (showWelcome) {
    return (
      <HintCard
        icon="waving_hand"
        testId="hint-welcome"
        closeLabel={t('Close', { description: 'Button closing a hint' })}
        onClose={() => dismiss.mutate('welcome')}
        actions={
          <>
            <Button size="small" onClick={() => dismiss.mutate('welcome')}>
              {t('Got it', { description: 'Button closing a hint' })}
            </Button>
            {providers.length > 1 && (
              <SignInMethodsLink
                label={t('Sign-in methods', {
                  description: 'Link to the sign-in methods page',
                })}
              />
            )}
          </>
        }
      >
        <Text $weight="600">
          {t('Welcome to Collaborators!', {
            description: 'Welcome note of a new account',
          })}
        </Text>
        <Text $size="sm">
          {t(
            'A new account was created for {{email}}. If you already have a Collaborators account under another email, this is a separate one: sign out and sign in with your usual account instead.',
            {
              description: 'Welcome note of a new account',
              email: user?.email ?? '',
            },
          )}
        </Text>
        {providers.length > 1 && (
          <Text $size="sm">
            {t(
              'To sign in here with your other Google, Microsoft or LinkedIn accounts too, connect them on the sign-in methods page.',
              { description: 'Welcome note of a new account' },
            )}
          </Text>
        )}
      </HintCard>
    );
  }

  if (dismissed('connect-accounts') || !hasUnconnectedProviders(methods)) {
    return null;
  }

  return (
    <HintCard
      icon="warning"
      tone="warning"
      testId="hint-connect-accounts"
      closeLabel={t("Don't show again", {
        description: 'Button closing a hint for good',
      })}
      onClose={() => dismiss.mutate('connect-accounts')}
      actions={
        <>
          <SignInMethodsLink
            primary
            label={t('Connect an account', {
              description: 'Button opening the sign-in methods page',
            })}
          />
          <Button
            size="small"
            variant="secondary"
            onClick={() => dismiss.mutate('connect-accounts')}
          >
            {t("Don't show again", {
              description: 'Button closing a hint for good',
            })}
          </Button>
        </>
      }
    >
      <ConnectAccountsText />
    </HintCard>
  );
};
