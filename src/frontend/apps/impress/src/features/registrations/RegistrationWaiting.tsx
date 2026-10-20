import { Button } from '@gouvfr-lasuite/ui-components';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Box, Icon, Text } from '@/components';
import { Title } from '@/components/Title';
import { KEY_AUTH, User } from '@/features/auth/api';
import { gotoLogout } from '@/features/auth/utils';
import { Footer } from '@/features/footer/Footer';
import { useResponsiveStore } from '@/stores';

/**
 * What a newcomer sees instead of the platform until a platform
 * administrator lets them in, or once declined. They are emailed either way.
 */
export const RegistrationWaiting = ({ user }: { user: User }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isSmallMobile } = useResponsiveStore();
  const declined = user.registration_status === 'declined';

  return (
    <Box
      as="main"
      $height="100vh"
      $css="overflow-y: auto;"
      data-testid="registration-waiting"
    >
      <Box
        $flex={1}
        $align="center"
        $justify="center"
        $gap="md"
        $padding={{ horizontal: isSmallMobile ? 'sm' : 'lg', vertical: 'lg' }}
      >
        <Title headingLevel="h1" $size={isSmallMobile ? '1.8rem' : '2.6rem'} />
        <Box $align="center" $gap="xs" $maxWidth="480px">
          <Icon
            iconName={declined ? 'block' : 'hourglass_top'}
            $size="40px"
            $theme={declined ? 'danger' : 'brand'}
          />
          <Text
            as="h2"
            $size="lg"
            $weight="600"
            $margin="none"
            $textAlign="center"
          >
            {declined
              ? t('Your registration was not accepted', {
                  description: 'Heading for a declined newcomer',
                })
              : t('Your registration is waiting for approval', {
                  description: 'Heading for a newcomer not let in yet',
                })}
          </Text>
          <Text $variation="secondary" $textAlign="center">
            {declined
              ? t(
                  'An administrator did not accept your registration. If you think this is a mistake, please contact the platform’s administrators.',
                  { description: 'Explanation for a declined newcomer' },
                )
              : t(
                  'Thank you for registering, {{name}}. An administrator will review your registration; you will receive an email at {{email}} once it is accepted.',
                  {
                    description: 'Explanation for a newcomer not let in yet',
                    name: user.full_name,
                    email: user.email,
                  },
                )}
          </Text>
        </Box>
        <Box $direction="row" $gap="xs" $css="flex-wrap: wrap;">
          {!declined && (
            <Button
              variant="secondary"
              icon={<Icon iconName="refresh" $color="inherit" />}
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: [KEY_AUTH] })
              }
            >
              {t('Check again', {
                description:
                  'Button checking whether a registration was accepted',
              })}
            </Button>
          )}
          <Button
            variant="tertiary"
            icon={<Icon iconName="logout" $color="inherit" />}
            onClick={gotoLogout}
          >
            {t('Sign out', { description: 'Button signing out' })}
          </Button>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
