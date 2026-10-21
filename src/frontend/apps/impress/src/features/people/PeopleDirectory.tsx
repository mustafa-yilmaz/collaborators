import { Input } from '@gouvfr-lasuite/ui-components';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebounce } from 'use-debounce';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { Box, Icon, Loading, StyledLink, Text } from '@/components';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { CARD_ICON_GAP } from '@/features/dashboard/CardParts';
import { profileHref } from '@/features/profile/api';

/** Someone one may see, with what their profile lets one see. */
export interface DirectoryPerson {
  id: string;
  full_name: string;
  email: string;
  headline: string;
  organization: string;
  /** Shares a workspace, a space or a page with the viewer */
  is_colleague: boolean;
  /** The workspaces both are members of */
  workspaces: string[];
}

export const usePeopleDirectory = (query: string) =>
  useQuery<DirectoryPerson[], APIError>({
    queryKey: ['people-directory', query],
    queryFn: async () => {
      const response = await fetchAPI(
        `people/directory/?q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) {
        throw new APIError(
          'Failed to list people',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<DirectoryPerson[]>;
    },
  });

const rowCss = css`
  display: flex;
  align-items: center;
  gap: ${CARD_ICON_GAP};
  padding: var(--c--globals--spacings--2xs) var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  color: inherit;
  text-decoration: none;
  &:hover {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

/**
 * "My Collaborators": everyone one may see, those one shares a workspace,
 * space or page with first, then those who let everyone find them. Each
 * opens their profile.
 */
export const PeopleDirectory = () => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query.trim(), 250);
  const { data: people = [], isLoading } = usePeopleDirectory(debounced);
  const colleagues = people.filter((person) => person.is_colleague);
  const others = people.filter((person) => !person.is_colleague);

  const row = (person: DirectoryPerson) => {
    const about = [person.headline, person.organization]
      .filter(Boolean)
      .join(' · ');
    const shared = person.workspaces.length
      ? t('In {{workspaces}}', {
          description: 'The workspaces shared with someone',
          workspaces: person.workspaces.join(', '),
        })
      : '';
    return (
      <StyledLink
        key={person.id}
        href={profileHref(person.id)}
        $css={rowCss}
        data-testid={`person-${person.id}`}
      >
        <UserAvatar fullName={person.full_name || person.email || '?'} />
        <Box $css="min-width: 0;" $flex={1}>
          <Text $size="sm" $weight="600" $ellipsis>
            {person.full_name || person.email}
          </Text>
          {(about || shared || person.email) && (
            <Text $size="xs" $variation="secondary" $ellipsis>
              {[about, shared, about || shared ? '' : person.email]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </Box>
      </StyledLink>
    );
  };

  const section = (title: string, list: DirectoryPerson[], help: string) =>
    list.length > 0 && (
      <Box as="section" $gap="2xs">
        <Box
          $gap="4xs"
          $css={css`
            border-bottom: 1px solid
              var(--c--contextuals--border--surface--primary);
            padding-bottom: var(--c--globals--spacings--3xs);
          `}
        >
          <Text as="h2" $size="md" $weight="700" $margin="none">
            {title}
          </Text>
          <Text $size="xs" $variation="secondary">
            {help}
          </Text>
        </Box>
        <Box $gap="4xs">{list.map(row)}</Box>
      </Box>
    );

  return (
    <Box $gap="md" data-testid="people-directory">
      <Input
        fullWidth
        label={t('Find someone', {
          description: 'Label of the search in My Collaborators',
        })}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        icon={<Icon iconName="search" $size="20px" />}
      />
      {isLoading && <Loading />}
      {!isLoading && !people.length && (
        <Text $size="sm" $variation="secondary">
          {debounced
            ? t('Nobody found.', {
                description: 'My Collaborators: no match',
              })
            : t(
                'People you share a workspace, a space or a page with appear here, and those who let everyone find them.',
                { description: 'My Collaborators: empty' },
              )}
        </Text>
      )}
      {section(
        t('People I work with', {
          description: 'Heading of the colleagues in My Collaborators',
        }),
        colleagues,
        t('You share a workspace, a space or a page.', {
          description: 'Explanation of the colleagues in My Collaborators',
        }),
      )}
      {section(
        t('Open to everyone', {
          description: 'Heading of the findable people in My Collaborators',
        }),
        others,
        t('They let everyone on Collaborators find them.', {
          description: 'Explanation of the findable people',
        }),
      )}
    </Box>
  );
};
