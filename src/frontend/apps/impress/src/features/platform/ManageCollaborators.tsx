import { Button, Input } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebounce } from 'use-debounce';

import { Box, Icon, Loading, StyledLink, Text } from '@/components';
import { PlatformRole } from '@/features/auth/api';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { profileHref } from '@/features/profile/api';

import { PlatformPeopleParams, PlatformPerson, usePlatformPeople } from './api';

const rowCss = css`
  border-top: 1px solid var(--c--contextuals--border--surface--primary);
  padding-top: var(--c--globals--spacings--xs);
  flex-wrap: wrap;
`;

const badgeCss = css`
  padding: 0 var(--c--globals--spacings--3xs);
  border-radius: var(--c--globals--spacings--3xs);
  border: 1px solid var(--c--contextuals--border--surface--primary);
  white-space: nowrap;
`;

/** The names of the levels and registration statuses, as the screen says them. */
const usePlatformWords = () => {
  const { t } = useTranslation();
  const levels: Record<PlatformRole, string> = {
    collaborator: t('Collaborator', {
      description: 'Platform level: anyone with an account',
    }),
    manager: t('Platform manager', {
      description: 'Platform level: approves registrations',
    }),
    administrator: t('Platform administrator', {
      description: 'Platform level: suspends and removes accounts',
    }),
    owner: t('Platform owner', {
      description: 'Platform level: appoints administrators and owners',
    }),
  };
  const statuses: Record<PlatformPerson['registration_status'], string> = {
    approved: t('Approved', { description: 'Registration status' }),
    pending: t('Waiting for approval', { description: 'Registration status' }),
    declined: t('Declined', { description: 'Registration status' }),
  };
  return { levels, statuses };
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
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetching } =
    usePlatformPeople({ q: debounced, role, status });
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
      {isLoading && <Loading />}
      {isError && (
        <Text $variation="secondary">
          {t('Only platform managers and those above them see everyone.', {
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
