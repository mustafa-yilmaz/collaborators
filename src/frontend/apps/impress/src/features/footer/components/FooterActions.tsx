import { Button, UserMenu } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Icon } from '@/components';
import { Waffle } from '@/components/Waffle';
import { useConfig } from '@/core';
import { ButtonLogin, gotoLogout, useAuth } from '@/features/auth';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language/components/LanguagePicker';

const FooterActionsGlobalStyle = createGlobalStyle`
  .user-menu__actions .c__language-picker{
    width: auto;
  }
`;

type FooterActionsProps = {
  withLogin?: boolean;
};

export const FooterActions = ({ withLogin }: FooterActionsProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: config } = useConfig();
  const singleLanguage = config?.theme_customization?.single_language;
  // Collaborators: where to add or remove the providers one signs in with,
  // a page of the app (it links to the sign-in server's own when needed)
  const signInMethods =
    user && config?.COLLABORATORS_SIGNIN_PROVIDERS?.length ? (
      <Button
        size="small"
        variant="tertiary"
        color="neutral"
        href="/account/sign-in-methods/"
        icon={<Icon iconName="key" $size="18px" $color="inherit" />}
      >
        {t('Sign-in methods', {
          description:
            'Link to the page listing the providers one signs in with',
        })}
      </Button>
    ) : undefined;
  // Collaborators: one's profile, and who sees each piece of it
  const myProfile = user ? (
    <Button
      size="small"
      variant="tertiary"
      color="neutral"
      href="/account/profile/"
      icon={<Icon iconName="badge" $size="18px" $color="inherit" />}
    >
      {t('My profile', { description: 'Link to the profile settings page' })}
    </Button>
  ) : undefined;

  const userMenu = user || {
    full_name: t('Guest', {
      description: 'Name displayed for a user not logged in',
    }),
    email: '',
  };

  return (
    <>
      <FooterActionsGlobalStyle />
      <Box
        $padding={{ horizontal: 'sm' }}
        $direction="row"
        $align="center"
        $gap="3xs"
        $justify="space-between"
        className="--docs--footer-actions"
      >
        <Box $direction="row" $align="center" $gap="3xs">
          <UserMenu
            user={userMenu}
            logout={user ? gotoLogout : undefined}
            actions={
              singleLanguage ? (
                <>
                  {myProfile}
                  {signInMethods}
                </>
              ) : (
                <>
                  {myProfile}
                  {signInMethods}
                  <LanguagePicker />
                </>
              )
            }
            withMobileView={false}
          />
          <Waffle />
          {withLogin && <ButtonLogin />}
        </Box>
        <HelpMenu />
      </Box>
    </>
  );
};
