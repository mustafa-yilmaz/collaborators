import { Input } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';
import { useDebounce } from 'use-debounce';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useConfig } from '@/core';
import { User } from '@/features/auth';
import {
  KEY_LIST_USER,
  useUsers,
} from '@/features/docs/doc-share/api/useUsers';
import { SearchUserRow } from '@/features/docs/doc-share/components/SearchUserRow';
import { isValidEmail } from '@/utils';

interface UserPickerProps {
  label: string;
  onPick: (user: User) => void;
  /** Users to leave out of the results, e.g. those already picked. */
  excludeIds?: string[];
  /**
   * Collaborators: a full email finding nobody one may see is invited by
   * email (whether it has an account or not).
   */
  onInviteEmail?: (email: string) => void;
}

/**
 * Find a collaborator by name or full email, among the people one shares a
 * workspace, space or page with and those who let everyone find them; or
 * invite an email.
 */
export const UserPicker = ({
  label,
  onPick,
  excludeIds = [],
  onInviteEmail,
}: UserPickerProps) => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const minLength = config?.API_USERS_SEARCH_QUERY_MIN_LENGTH ?? 3;
  const { data: users = [], isFetching } = useUsers(
    { query: debouncedQuery, docId: '' },
    {
      queryKey: [KEY_LIST_USER, { query: debouncedQuery, docId: '' }],
      enabled: debouncedQuery.length >= minLength,
    },
  );
  const results = users.filter((user) => !excludeIds.includes(user.id));
  const showResults = debouncedQuery.length >= minLength;
  const email = debouncedQuery.trim().toLowerCase();
  const canInvite =
    !!onInviteEmail &&
    isValidEmail(email) &&
    !users.some((user) => user.email.toLowerCase() === email);

  return (
    <Box $gap="xs" $position="relative">
      <Input
        fullWidth
        label={label}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoComplete="off"
      />
      {showResults && (
        <Box
          role="listbox"
          aria-label={label}
          $css={css`
            border: 1px solid var(--c--contextuals--border--surface--primary);
            border-radius: var(--c--globals--spacings--3xs);
            max-height: 220px;
            overflow-y: auto;
          `}
        >
          {results.map((user) => (
            <BoxButton
              key={user.id}
              role="option"
              aria-selected={false}
              onClick={() => {
                onPick(user);
                setQuery('');
              }}
              $padding={{ horizontal: 'xs', vertical: '3xs' }}
              $width="100%"
              $css={css`
                &:hover {
                  background-color: var(
                    --c--contextuals--background--semantic--contextual--primary
                  );
                }
              `}
            >
              <SearchUserRow user={user} />
            </BoxButton>
          ))}
          {!isFetching && canInvite && (
            <BoxButton
              role="option"
              aria-selected={false}
              onClick={() => {
                onInviteEmail?.(email);
                setQuery('');
              }}
              $direction="row"
              $align="center"
              $gap="xs"
              $padding={{ horizontal: 'xs', vertical: 'xs' }}
              $width="100%"
              $css={css`
                &:hover {
                  background-color: var(
                    --c--contextuals--background--semantic--contextual--primary
                  );
                }
              `}
            >
              <Icon iconName="forward_to_inbox" $size="20px" $theme="brand" />
              <Text $size="sm">
                {t('Invite {{email}} by email', {
                  description: 'Option inviting an email address',
                  email,
                })}
              </Text>
            </BoxButton>
          )}
          {!isFetching && results.length === 0 && !canInvite && (
            <Text $size="sm" $variation="secondary" $padding="xs">
              {onInviteEmail
                ? t(
                    'Nobody found among the people you work with. Type a full email address to invite someone.',
                    {
                      description:
                        'Shown when a collaborator search finds nobody',
                    },
                  )
                : t(
                    'No collaborator found. Try their full email address: they need to have signed in once.',
                    {
                      description:
                        'Shown when a collaborator search finds nobody',
                    },
                  )}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
