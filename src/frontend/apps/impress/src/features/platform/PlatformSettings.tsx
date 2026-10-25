import { Button, Checkbox } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Loading, Text } from '@/components';

import {
  PlatformSettingName,
  usePlatformSettings,
  useUpdatePlatformSettings,
} from './api';

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
`;

/** "Settings", for platform owners: what the platform does for everyone. */
export const PlatformSettings = () => {
  const { t } = useTranslation();
  const { data, isLoading } = usePlatformSettings();
  const update = useUpdatePlatformSettings();
  const texts: Record<PlatformSettingName, { label: string; help: string }> = {
    signup_approval: {
      label: t('New registrations wait for approval', {
        description: 'Platform setting',
      }),
      help: t(
        'Someone signing in for the first time waits until a manager lets them in. People invited by email never wait.',
        { description: 'Explanation of the registration approval setting' },
      ),
    },
    email_invitations: {
      label: t('Invitations by email', { description: 'Platform setting' }),
      help: t(
        'Workspaces, spaces and pages can invite people by email, who sign up from the invitation.',
        { description: 'Explanation of the email invitations setting' },
      ),
    },
  };
  const onOff = (value: boolean) =>
    value
      ? t('on', { description: 'A setting turned on' })
      : t('off', { description: 'A setting turned off' });

  return (
    <Box $gap="sm" data-testid="platform-settings">
      <Text $variation="secondary">
        {t(
          'These apply to everyone on the platform. A setting you never changed follows the server’s own. Every change is logged.',
          { description: 'Introduction of the platform settings tab' },
        )}
      </Text>
      {isLoading && <Loading />}
      {data &&
        (Object.keys(texts) as PlatformSettingName[]).map((name) => (
          <Box key={name} $gap="4xs" $css={rowCss}>
            <Checkbox
              label={texts[name].label}
              checked={data[name].value}
              disabled={update.isPending}
              onChange={(event) =>
                update.mutate({ [name]: event.target.checked })
              }
            />
            <Text $size="xs" $variation="secondary">
              {texts[name].help}
            </Text>
            <Box $direction="row" $align="center" $gap="xs">
              <Text $size="xs" $variation="secondary">
                {t('The server’s own: {{value}}', {
                  description: 'The value of a setting set on the server',
                  value: onOff(data[name].server_default),
                })}
              </Text>
              {data[name].set_here && (
                <Button
                  size="small"
                  variant="tertiary"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ [name]: null })}
                >
                  {t('Follow the server’s own', {
                    description: 'Button forgetting a platform setting',
                  })}
                </Button>
              )}
            </Box>
          </Box>
        ))}
    </Box>
  );
};
