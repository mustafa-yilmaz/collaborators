import { Button } from '@gouvfr-lasuite/ui-components';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { Title } from '@/components/Title';
import { useConfig } from '@/core';
import { useAuth } from '@/features/auth';

import {
  Hint,
  SignInMethods,
  useDismissHint,
  useHints,
  useSignInMethods,
} from './api';
import { hideForThisVisit, isHiddenThisVisit } from './visit';

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

/** The name of the platform, as its logo, inside a sentence. */
const Brand = () => (
  <Title as="span" $size="0.95em" $css="vertical-align: bottom;" />
);

/** A bordered note; a warning only has its symbol in yellow. */
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
    $css={css`
      border: 1px solid var(--c--contextuals--border--surface--primary);
      border-radius: var(--c--globals--spacings--xs);
      background: var(
        --c--contextuals--background--semantic--contextual--primary
      );
    `}
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

/** The note about unconnected sign-in methods, in its own words. */
export const ConnectAccountsText = ({
  onSignInMethodsPage = false,
}: {
  onSignInMethodsPage?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <>
      <Text $weight="600">
        {t('Good to know: signing in with another account', {
          description: 'Note that only one sign-in method is connected',
        })}
      </Text>
      <Text $display="block" $size="sm">
        <Trans
          i18nKey="Signing in with another Google, Microsoft or LinkedIn account under a different email opens a separate <brand/> account."
          tOptions={{
            description: 'Note that only one sign-in method is connected',
          }}
          components={{ brand: <Brand /> }}
        />
      </Text>
      <Text $size="sm">
        {onSignInMethodsPage
          ? t(
              'To use the same single account every time, connect (merge) your accounts below.',
              { description: 'Hint to connect other sign-in methods' },
            )
          : t(
              'To use the same single account every time, connect (merge) your accounts on the sign-in methods page.',
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
 * Dashboard notes about signing in, one at a time:
 * - a welcome, in case the person already has another account (signed in
 *   with another provider and email, it is a separate one). Closed, it comes
 *   back at their next visit, in returning words;
 * - while a single provider is connected, a note says so and where to
 *   connect the others, so all of them open this same account. It stays
 *   until another one is connected.
 */
export const AccountHints = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: config } = useConfig();
  const { data: hints } = useHints();
  const dismiss = useDismissHint();
  const providers = config?.COLLABORATORS_SIGNIN_PROVIDERS ?? [];
  const dismissed = (hint: Hint) => !!hints?.dismissed.includes(hint);
  // Closed for this visit only: it comes back at the next one (visit.ts)
  const [welcomeClosed, setWelcomeClosed] = useState(() =>
    isHiddenThisVisit('welcome'),
  );
  const closeWelcome = () => {
    hideForThisVisit('welcome');
    setWelcomeClosed(true);
  };
  // "A new account was created" only at the very first visit: the server
  // records that the welcome was seen as soon as it shows, and its words
  // stay the same until the page is left
  const returningRef = useRef<boolean | undefined>(undefined);
  if (hints && returningRef.current === undefined) {
    returningRef.current = dismissed('welcome');
  }
  const returning = !!returningRef.current;
  const showWelcome = !!hints && !welcomeClosed;
  const seen = dismissed('welcome');
  const { mutate: markSeen, isIdle } = dismiss;
  useEffect(() => {
    if (showWelcome && !seen && isIdle) {
      markSeen('welcome');
    }
  }, [showWelcome, seen, isIdle, markSeen]);
  const { data: methods } = useSignInMethods(
    !!hints && !showWelcome && providers.length > 1,
  );

  if (showWelcome) {
    return (
      <HintCard
        icon="waving_hand"
        testId="hint-welcome"
        closeLabel={t('Close', { description: 'Button closing a hint' })}
        onClose={closeWelcome}
        actions={
          <>
            <Button size="small" onClick={closeWelcome}>
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
        <Text $display="block" $weight="600">
          {returning ? (
            t('Welcome back!', {
              description: 'Welcome note at a later visit',
            })
          ) : (
            <Trans
              i18nKey="Welcome to <brand/>!"
              tOptions={{ description: 'Welcome note of a new account' }}
              components={{ brand: <Brand /> }}
            />
          )}
        </Text>
        {/* Three rows, a blank line between each */}
        <Box
          $css={css`
            row-gap: 1.25em;
            row-gap: 1lh;
          `}
        >
          <Text $display="block" $size="sm">
            {returning ? (
              <Trans
                i18nKey="You're signed in to <brand/> with the email address <strong>{{email}}</strong>."
                values={{ email: user?.email ?? '' }}
                tOptions={{ description: 'Welcome note at a later visit' }}
                components={{ brand: <Brand />, strong: <strong /> }}
              />
            ) : (
              t('A new account was created for {{email}}.', {
                description: 'Welcome note of a new account',
                email: user?.email ?? '',
              })
            )}
          </Text>
          <Text $display="block" $size="sm">
            {returning
              ? t(
                  'If you have another account under another email, it is a separate one: sign out and sign in with your usual account instead.',
                  { description: 'Welcome note at a later visit' },
                )
              : t(
                  'If you already have another account under another email, this is a separate one: sign out and sign in with your usual account instead.',
                  { description: 'Welcome note of a new account' },
                )}
          </Text>
          {providers.length > 1 && (
            <Text $display="block" $size="sm">
              {t(
                'To sign in here with your other Google, Microsoft or LinkedIn accounts too, connect them on the sign-in methods page.',
                { description: 'Welcome note of a new account' },
              )}
            </Text>
          )}
        </Box>
      </HintCard>
    );
  }

  if (!hasUnconnectedProviders(methods)) {
    return null;
  }

  return (
    <HintCard
      icon="warning"
      tone="warning"
      testId="hint-connect-accounts"
      actions={
        <SignInMethodsLink
          label={t('Sign-in methods', {
            description: 'Link to the sign-in methods page',
          })}
        />
      }
    >
      <ConnectAccountsText />
    </HintCard>
  );
};
