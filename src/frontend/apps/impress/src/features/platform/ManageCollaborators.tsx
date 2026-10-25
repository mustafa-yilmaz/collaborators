import { Button, Input } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebounce } from 'use-debounce';

import { Box, Icon, Loading, StyledLink, Text } from '@/components';
import { PlatformRole } from '@/features/auth/api';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { profileHref } from '@/features/profile/api';

import {
  LevelDialog,
  RemoveDialog,
  SuspendDialog,
  useOutcomeToast,
} from './AccountDialogs';
import {
  PlatformPeopleParams,
  PlatformPerson,
  usePlatformPeople,
  useReinstatePerson,
} from './api';
import { usePlatformWords } from './words';

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
  flex-wrap: wrap;
`;

const suspendedCss = css`
  padding: 0 var(--c--globals--spacings--3xs);
  border-radius: var(--c--globals--spacings--3xs);
  white-space: nowrap;
  color: var(--c--contextuals--content--semantic--error--primary);
  border: 1px solid currentColor;
`;

const badgeCss = css`
  padding: 0 var(--c--globals--spacings--3xs);
  border-radius: var(--c--globals--spacings--3xs);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  white-space: nowrap;
`;

/**
 * Level, suspend or reinstate, and remove: for people below one's level;
 * an owner also changes another owner's level.
 */
const PersonActions = ({ person }: { person: PlatformPerson }) => {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<'level' | 'suspend' | 'remove' | null>(
    null,
  );
  const reinstate = useReinstatePerson();
  const outcomeToast = useOutcomeToast();
  const name = person.full_name || person.email;

  return (
    <Box $direction="row" $gap="xs">
      {person.levels_you_may_give.length > 0 && (
        <Button
          size="small"
          variant="secondary"
          onClick={() => setDialog('level')}
        >
          {t('Level', { description: 'Button changing someone’s level' })}
        </Button>
      )}
      {/* Only below one's own level (an owner's row offers its level) */}
      {person.can_manage && person.suspended && (
        <Button
          size="small"
          variant="secondary"
          disabled={reinstate.isPending}
          onClick={() =>
            reinstate.mutate(
              { id: person.id },
              {
                onSuccess: ({ sign_in_server }) =>
                  outcomeToast(
                    t('{{name}} is reinstated.', {
                      description: 'Toast after reinstating an account',
                      name,
                    }),
                    sign_in_server,
                  ),
                onError: (error) =>
                  outcomeToast(error.cause?.[0] ?? error.message, 'failed'),
              },
            )
          }
        >
          {t('Reinstate', { description: 'Button reinstating an account' })}
        </Button>
      )}
      {person.can_manage && !person.suspended && (
        <Button
          size="small"
          variant="secondary"
          onClick={() => setDialog('suspend')}
        >
          {t('Suspend', { description: 'Button suspending an account' })}
        </Button>
      )}
      {person.can_manage && (
        <Button
          size="small"
          variant="secondary"
          color="error"
          onClick={() => setDialog('remove')}
        >
          {t('Remove', { description: 'Button removing an account' })}
        </Button>
      )}
      {dialog === 'level' && (
        <LevelDialog person={person} onClose={() => setDialog(null)} />
      )}
      {dialog === 'suspend' && (
        <SuspendDialog person={person} onClose={() => setDialog(null)} />
      )}
      {dialog === 'remove' && (
        <RemoveDialog person={person} onClose={() => setDialog(null)} />
      )}
    </Box>
  );
};

const PersonRow = ({ person }: { person: PlatformPerson }) => {
  const { t, i18n } = useTranslation();
  const { levels, statuses } = usePlatformWords();
  const name = person.full_name || person.email;
  const date = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language, { dateStyle: 'medium' });

  return (
    <Box
      $direction="row"
      $align="center"
      $gap="sm"
      $css={rowCss}
      data-testid={`platform-person-${person.id}`}
    >
      <UserAvatar fullName={name || '?'} />
      <Box $flex={1} $css="min-width: 200px;" $gap="4xs">
        <Box $direction="row" $align="center" $gap="xs" $wrap="wrap">
          <StyledLink href={profileHref(person.id)} $css="color: inherit;">
            <Text $weight="600">{name}</Text>
          </StyledLink>
          {person.platform_role !== 'collaborator' && (
            <Text $size="xs" $weight="600" $css={badgeCss}>
              {levels[person.platform_role]}
            </Text>
          )}
          {person.suspended && (
            <Text $size="xs" $weight="600" $css={suspendedCss}>
              {t('Suspended', { description: 'An account suspended' })}
            </Text>
          )}
          {person.registration_status !== 'approved' && (
            <Text $size="xs" $variation="secondary" $css={badgeCss}>
              {statuses[person.registration_status]}
            </Text>
          )}
        </Box>
        <Text $size="sm" $variation="secondary">
          {person.email}
          {' · '}
          {person.email_verified
            ? t('email verified by their provider', {
                description: 'A registration whose email is verified',
              })
            : t('email not verified', {
                description: 'A registration whose email is not verified',
              })}
        </Text>
        <Text $size="xs" $variation="secondary">
          {[
            t('Joined on {{date}}', {
              description: 'When someone made their account',
              date: date(person.created_at),
            }),
            person.last_login
              ? t('last signed in on {{date}}', {
                  description: 'When someone last signed in',
                  date: date(person.last_login),
                })
              : t('no sign-in recorded', {
                  description: 'Someone whose last sign-in is unknown',
                }),
            person.workspaces === 1
              ? t('1 workspace', {
                  description: 'Someone is a member of one workspace',
                })
              : t('{{number}} workspaces', {
                  description: 'How many workspaces someone is a member of',
                  number: person.workspaces,
                }),
            person.pages === 1
              ? t('1 page owned', { description: 'Someone owns one page' })
              : t('{{number}} pages owned', {
                  description: 'How many pages someone owns',
                  number: person.pages,
                }),
          ].join(' · ')}
        </Text>
      </Box>
      {(person.can_manage || person.levels_you_may_give.length > 0) && (
        <PersonActions person={person} />
      )}
    </Box>
  );
};

/** A row of buttons choosing one value, "All" first. */
const Choice = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | '';
  options: [T | '', string][];
  onChange: (value: T | '') => void;
}) => (
  <Box $direction="row" $align="center" $gap="3xs" $wrap="wrap">
    <Text $size="sm" $variation="secondary" $margin={{ right: '3xs' }}>
      {label}
    </Text>
    {options.map(([option, text]) => (
      <Button
        key={option || 'all'}
        size="small"
        variant={value === option ? 'primary' : 'tertiary'}
        aria-pressed={value === option}
        onClick={() => onChange(option)}
      >
        {text}
      </Button>
    ))}
  </Box>
);

/**
 * "Manage Collaborators": everyone with an account, for platform managers
 * and the levels above them, found by name or email, level or registration.
 */
export const ManageCollaborators = () => {
  const { t } = useTranslation();
  const { levels, statuses } = usePlatformWords();
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query.trim(), 250);
  const [role, setRole] = useState<PlatformPeopleParams['role']>('');
  const [status, setStatus] = useState<PlatformPeopleParams['status']>('');
  const [account, setAccount] =
    useState<NonNullable<PlatformPeopleParams['account']>>('');
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetching } =
    usePlatformPeople({ q: debounced, role, status, account });
  const people = data?.pages.flatMap((page) => page.results) ?? [];
  const count = data?.pages[0]?.count ?? 0;
  const all = t('All', { description: 'Filter choice: no filter' });

  return (
    <Box $gap="sm" data-testid="manage-collaborators">
      <Input
        fullWidth
        label={t('Find someone by name or email', {
          description: 'Label of the search in Manage Collaborators',
        })}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        icon={<Icon iconName="search" $size="20px" />}
      />
      <Choice
        label={t('Level', { description: 'Filter of the platform level' })}
        value={role}
        onChange={setRole}
        options={[
          ['', all],
          ...(Object.entries(levels) as [PlatformRole, string][]),
        ]}
      />
      <Choice
        label={t('Registration', {
          description: 'Filter of the registration status',
        })}
        value={status}
        onChange={setStatus}
        options={[
          ['', all],
          ...(Object.entries(statuses) as [
            PlatformPerson['registration_status'],
            string,
          ][]),
        ]}
      />
      <Choice
        label={t('Account', { description: 'Filter of active or suspended' })}
        value={account}
        onChange={setAccount}
        options={[
          ['', all],
          ['active', t('Active', { description: 'An account not suspended' })],
          [
            'suspended',
            t('Suspended', { description: 'An account suspended' }),
          ],
        ]}
      />
      {isLoading && <Loading />}
      {isError && (
        <Text $variation="secondary">
          {t('Only managers and those above them see everyone.', {
            description: 'Manage Collaborators for someone else',
          })}
        </Text>
      )}
      {data && (
        <Text $size="sm" $variation="secondary">
          {count === 1
            ? t('1 person', {
                description: 'Manage Collaborators lists one person',
              })
            : t('{{number}} people', {
                description: 'How many people Manage Collaborators lists',
                number: count,
              })}
        </Text>
      )}
      {people.map((person) => (
        <PersonRow key={person.id} person={person} />
      ))}
      {hasNextPage && (
        <Box $align="flex-start">
          <Button
            size="small"
            variant="secondary"
            disabled={isFetching}
            onClick={() => void fetchNextPage()}
          >
            {t('Show more', { description: 'Button loading more people' })}
          </Button>
        </Box>
      )}
    </Box>
  );
};
