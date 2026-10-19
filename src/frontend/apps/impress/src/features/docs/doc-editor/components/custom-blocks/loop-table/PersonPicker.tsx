import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';

import { Icon } from '@/components';
import { useConfig } from '@/core';
import {
  KEY_LIST_USER,
  useUsers,
} from '@/features/docs/doc-share/api/useUsers';
import { useGrantableTeams } from '@/features/workspaces/api';

import { Popover } from './Popover';
import { PersonValue } from './model';

interface PersonPickerProps {
  docId: string;
  value: PersonValue[];
  onChange: (value: PersonValue[]) => void;
  onClose: () => void;
}

/** Pick collaborators and groups for a Person cell. */
export const PersonPicker = ({
  docId,
  value,
  onChange,
  onClose,
}: PersonPickerProps) => {
  const { t } = useTranslation();
  const { data: config } = useConfig();
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query, 250);
  const minLength = config?.API_USERS_SEARCH_QUERY_MIN_LENGTH ?? 3;
  const { data: users = [] } = useUsers(
    { query: debounced, docId: '' },
    {
      queryKey: [KEY_LIST_USER, { query: debounced, docId: '' }],
      enabled: debounced.length >= minLength,
    },
  );
  const { data: teams = [] } = useGrantableTeams(docId, debounced);
  const selectedIds = value.map((person) => person.id);

  const add = (person: PersonValue) => {
    if (!selectedIds.includes(person.id)) {
      onChange([...value, person]);
    }
    setQuery('');
  };

  return (
    <Popover
      onClose={onClose}
      label={t('Choose people or groups', {
        description: 'Accessible name of the person picker of a table cell',
      })}
    >
      {value.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          {value.map((person) => (
            <span
              key={person.id}
              className="loop-table__chip"
              style={{ background: '#ECE6FB', color: '#4F3497' }}
            >
              <Icon
                iconName={person.kind === 'group' ? 'groups' : 'person'}
                $size="14px"
              />
              {person.label}
              <button
                type="button"
                aria-label={t('Remove {{name}}', {
                  description: 'Remove a person from a table cell',
                  name: person.label,
                })}
                onClick={() =>
                  onChange(value.filter((item) => item.id !== person.id))
                }
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0,
                  color: 'inherit',
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        autoFocus
        style={{ width: '100%' }}
        placeholder={t('Search a name, email or group', {
          description: 'Placeholder of the person picker of a table cell',
        })}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div style={{ marginTop: 6, maxHeight: 240, overflowY: 'auto' }}>
        {teams
          .filter((team) => !selectedIds.includes(team.team))
          .slice(0, 8)
          .map((team) => (
            <button
              key={team.team}
              type="button"
              className="loop-table__popover-item"
              onClick={() =>
                add({ kind: 'group', id: team.team, label: team.label })
              }
            >
              <Icon iconName="groups" $size="18px" />
              <span>{team.label}</span>
              <span className="loop-table__muted">{team.workspace.name}</span>
            </button>
          ))}
        {debounced.length >= minLength &&
          users
            .filter((user) => !selectedIds.includes(user.id))
            .map((user) => (
              <button
                key={user.id}
                type="button"
                className="loop-table__popover-item"
                onClick={() =>
                  add({
                    kind: 'user',
                    id: user.id,
                    label: user.full_name || user.email,
                  })
                }
              >
                <Icon iconName="person" $size="18px" />
                <span>{user.full_name || user.email}</span>
                {user.full_name && (
                  <span className="loop-table__muted">{user.email}</span>
                )}
              </button>
            ))}
        {debounced.length > 0 && debounced.length < minLength && (
          <div className="loop-table__muted" style={{ padding: 6 }}>
            {t('Type at least {{count}} characters to find people', {
              description: 'Hint of the person picker of a table cell',
              count: minLength,
            })}
          </div>
        )}
      </div>
    </Popover>
  );
};
