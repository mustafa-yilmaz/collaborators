import {
  Button,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, Loading, Text } from '@/components';
import { UserAvatar } from '@/features/auth/components/UserAvatar';

import {
  Registration,
  RegistrationStatus,
  useDecideRegistration,
  useRegistrations,
} from './api';

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--sm);
  flex-wrap: wrap;
`;

const RegistrationRow = ({ registration }: { registration: Registration }) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToastProvider();
  const decide = useDecideRegistration();
  const name = registration.full_name || registration.email;

  const onDecide = (decision: 'approve' | 'decline') =>
    decide.mutate(
      { id: registration.id, decision },
      {
        onSuccess: () =>
          toast(
            decision === 'approve'
              ? t('{{name}} is let in and was told by email.', {
                  description: 'Toast after approving a registration',
                  name,
                })
              : t(
                  '{{name}} was told by email that the registration was declined.',
                  {
                    description: 'Toast after declining a registration',
                    name,
                  },
                ),
            VariantType.SUCCESS,
          ),
        onError: () =>
          toast(
            t('Something went wrong.', {
              description: 'Generic error message',
            }),
            VariantType.ERROR,
          ),
      },
    );

  return (
    <Box
      $direction="row"
      $align="center"
      $gap="sm"
      $css={rowCss}
      data-testid={`registration-${registration.id}`}
    >
      <UserAvatar fullName={name} />
      <Box $flex={1} $css="min-width: 200px;">
        <Text $weight="600">{name}</Text>
        <Text $size="sm" $variation="secondary">
          {registration.email}
          {' · '}
          {registration.email_verified
            ? t('email verified by their provider', {
                description: 'A registration whose email is verified',
              })
            : t('email not verified', {
                description: 'A registration whose email is not verified',
              })}
        </Text>
        <Text $size="xs" $variation="secondary">
          {t('Registered on {{date}}', {
            description: 'When someone registered',
            date: new Date(registration.created_at).toLocaleString(
              i18n.language,
              { dateStyle: 'medium', timeStyle: 'short' },
            ),
          })}
        </Text>
      </Box>
      <Box $direction="row" $gap="xs">
        <Button
          size="small"
          disabled={decide.isPending}
          icon={<Icon iconName="how_to_reg" $color="inherit" />}
          onClick={() => onDecide('approve')}
        >
          {t('Approve', { description: 'Button approving a registration' })}
        </Button>
        {registration.status === 'pending' && (
          <Button
            size="small"
            variant="secondary"
            color="error"
            disabled={decide.isPending}
            onClick={() => onDecide('decline')}
          >
            {t('Decline', { description: 'Button declining a registration' })}
          </Button>
        )}
      </Box>
    </Box>
  );
};

/** The registrations platform managers decide on. */
export const RegistrationList = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RegistrationStatus>('pending');
  const { data, isLoading, isError } = useRegistrations(status);

  return (
    <Box $gap="sm" data-testid="registration-list">
      <Box $direction="row" $gap="xs">
        <Button
          size="small"
          variant={status === 'pending' ? 'primary' : 'tertiary'}
          onClick={() => setStatus('pending')}
        >
          {t('Waiting', { description: 'Tab of registrations to decide on' })}
        </Button>
        <Button
          size="small"
          variant={status === 'declined' ? 'primary' : 'tertiary'}
          onClick={() => setStatus('declined')}
        >
          {t('Declined', { description: 'Tab of declined registrations' })}
        </Button>
      </Box>
      {isLoading && <Loading />}
      {isError && (
        <Text $variation="secondary">
          {t('Only platform managers decide on registrations.', {
            description: 'Registrations page for someone else',
          })}
        </Text>
      )}
      {data?.length === 0 && (
        <Text $variation="secondary">
          {status === 'pending'
            ? t('Nobody is waiting for approval.', {
                description: 'No registration to decide on',
              })
            : t('No registration was declined.', {
                description: 'No declined registration',
              })}
        </Text>
      )}
      {data?.map((registration) => (
        <RegistrationRow key={registration.id} registration={registration} />
      ))}
    </Box>
  );
};
