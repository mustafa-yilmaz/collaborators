import { Button, UserMenu } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { createGlobalStyle } from 'styled-components';

import { Box, Icon } from '@/components';
import { Waffle } from '@/components/Waffle';
import { useConfig } from '@/core';
import {
  ButtonLogin,
  gotoLogout,
  hasPlatformLevel,
  useAuth,
} from '@/features/auth';
import { HelpMenu } from '@/features/help';
import { LanguagePicker } from '@/features/language/components/LanguagePicker';
import { SidebarSideSwitch } from '@/features/left-panel/components/SidebarSideSwitch';

const FooterActionsGlobalStyle = createGlobalStyle`
  .user-menu__actions .c__language-picker{
    width: auto;
  }
`;

type FooterActionsProps = {
  withLogin?: boolean;
  /** Collaborators: the slider moving the panel, between profile and help */
  withSideSwitch?: boolean;
};

export const FooterActions = ({
  withLogin,
  withSideSwitch,
}: FooterActionsProps) => {
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

  // Collaborators: platform managers (and those above) let newcomers in
  const registrations = hasPlatformLevel(user, 'manager') ? (
    <Button
      size="small"
      variant="tertiary"
      color="neutral"
      href="/registrations/"
      icon={<Icon iconName="how_to_reg" $size="18px" $color="inherit" />}
    >
      {t('New registrations', {
        description: 'Link to the page approving new registrations',
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
                <>
                  {myProfile}
                  {signInMethods}
                  {registrations}
                </>
              ) : (
                <>
                  {myProfile}
                  {signInMethods}
                  {registrations}
                  <LanguagePicker />
                </>
              )
            }
            withMobileView={false}
          />
          <Waffle />
          {withLogin && <ButtonLogin />}
        </Box>
        {withSideSwitch && <SidebarSideSwitch />}
        <HelpMenu />
      </Box>
    </>
  );
};
