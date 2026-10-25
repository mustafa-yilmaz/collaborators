import { Button, Input } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Loading, Text } from '@/components';

import { useBlockEmail, useBlockedEmails, useUnblockEmail } from './api';

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
  flex-wrap: wrap;
`;

const errorCss = css`
  color: var(--c--contextuals--content--semantic--error--primary);
`;

/**
 * "Blocked accounts", for platform owners: the emails nobody signs in with,
 * whether or not they have an account yet (one that has is suspended).
 */
export const BlockedEmails = () => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const { data, isLoading } = useBlockedEmails();
  const block = useBlockEmail();
  const unblock = useUnblockEmail();

  return (
    <Box $gap="sm" data-testid="blocked-emails">
      <Text $variation="secondary">
        {t(
          'Nobody signs in with a blocked email, whether or not it has an account yet. An account with it is suspended; unblocking leaves it suspended until reinstated.',
          { description: 'Introduction of the blocked accounts tab' },
        )}
      </Text>
      <Box
        as="form"
        $direction="row"
        $gap="xs"
        $align="flex-start"
        $wrap="wrap"
        onSubmit={(event) => {
          event.preventDefault();
          block.mutate(
            { email, reason },
            {
              onSuccess: () => {
                setEmail('');
                setReason('');
              },
            },
          );
        }}
      >
        <Box $flex={1} $css="min-width: 220px;">
          <Input
            fullWidth
            type="email"
            label={t('Email to block', {
              description: 'Label of the email to block',
            })}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Box>
        <Box $flex={1} $css="min-width: 220px;">
          <Input
            fullWidth
            label={t('Reason (optional)', {
              description: 'Label of the reason for blocking',
            })}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </Box>
        <Button
          type="submit"
          color="error"
          disabled={!email.trim() || block.isPending}
        >
          {t('Block', { description: 'Button blocking an email' })}
        </Button>
      </Box>
      {block.error && (
        <Text $size="sm" $css={errorCss}>
          {block.error.cause?.[0]}
        </Text>
      )}
      {isLoading && <Loading />}
      {data?.length === 0 && (
        <Text $size="sm" $variation="secondary">
          {t('No email is blocked.', {
            description: 'No blocked email yet',
          })}
        </Text>
      )}
      {data?.map((blocked) => (
        <Box
          key={blocked.id}
          $direction="row"
          $align="center"
          $gap="sm"
          $css={rowCss}
          data-testid={`blocked-${blocked.email}`}
        >
          <Box $flex={1} $css="min-width: 200px;" $gap="4xs">
            <Text $weight="600">{blocked.email}</Text>
            <Text $size="xs" $variation="secondary">
              {[
                blocked.has_account
                  ? t('has an account (suspended)', {
                      description: 'A blocked email with an account',
                    })
                  : t('no account here', {
                      description: 'A blocked email without an account',
                    }),
                t('blocked on {{date}}', {
                  description: 'When an email was blocked',
                  date: new Date(blocked.created_at).toLocaleDateString(
                    i18n.language,
                    { dateStyle: 'medium' },
                  ),
                }),
                blocked.blocked_by &&
                  t('by {{name}}', {
                    description: 'Who blocked an email',
                    name: blocked.blocked_by,
                  }),
                blocked.reason,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </Box>
          <Button
            size="small"
            variant="secondary"
            disabled={unblock.isPending}
            onClick={() => unblock.mutate({ id: blocked.id })}
          >
            {t('Unblock', { description: 'Button unblocking an email' })}
          </Button>
        </Box>
      ))}
    </Box>
  );
};
