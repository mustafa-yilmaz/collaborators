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
  const accountUrl = config?.COLLABORATORS_ACCOUNT_URL;
  // Collaborators: where to add or remove the providers one signs in with
  const signInMethods =
    user && accountUrl ? (
      <Button
        size="small"
        variant="tertiary"
        color="neutral"
        href={accountUrl}
        target="_blank"
        rel="noopener noreferrer"
        icon={<Icon iconName="key" $size="18px" $color="inherit" />}
      >
        {t('Sign-in methods', {
          description:
            'Link to the page listing the providers one signs in with',
        })}
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
                signInMethods
              ) : (
                <>
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
