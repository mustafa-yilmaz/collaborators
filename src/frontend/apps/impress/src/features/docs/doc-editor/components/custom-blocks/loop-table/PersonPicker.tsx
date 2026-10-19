import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';

import { Icon } from '@/components';
import { useTrans } from '@/docs/doc-management';
import { useSearchDocs } from '@/docs/doc-search/api/useSearchDocs';
import { usePeopleToMention } from '@/features/docs/doc-share/api/usePeopleToMention';
import { useGrantableTeams } from '@/features/workspaces/api';

import { Popover } from './Popover';
import { PageRef } from './mentions';
import { PersonValue } from './model';

interface PersonPickerProps {
  docId: string;
  value: PersonValue[];
  onChange: (value: PersonValue[]) => void;
  onClose: () => void;
  /** In a text cell, pages can be linked too */
  onPickPage?: (page: PageRef) => void;
}

/**
 * Pick collaborators and groups for a Person cell, or someone, a group or a
 * page to mention in a text cell. People one works with show from the first
 * letter (or none).
 */
export const PersonPicker = ({
  docId,
  value,
  onChange,
  onClose,
  onPickPage,
}: PersonPickerProps) => {
  const { t } = useTranslation();
  const { untitledDocument } = useTrans();
  const [query, setQuery] = useState('');
  const [debounced] = useDebounce(query, 250);
  const users = usePeopleToMention(debounced);
  // Groups already given access to the page count too
  const { data: teams = [] } = useGrantableTeams(docId, debounced, true);
  const { data: pages } = useSearchDocs(
    { q: debounced, page: 1 },
    { enabled: !!onPickPage && debounced.trim().length > 0 },
  );
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
        placeholder={
          onPickPage
            ? t('Search a name, group or page', {
                description: 'Placeholder of the mention picker of a text cell',
              })
            : t('Search a name, email or group', {
                description: 'Placeholder of the person picker of a table cell',
              })
        }
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
        {users
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
        {onPickPage &&
          (pages?.results ?? [])
            .filter((page) => page.id !== docId)
            .slice(0, 6)
            .map((page) => (
              <button
                key={page.id}
                type="button"
                className="loop-table__popover-item"
                onClick={() =>
                  onPickPage({
                    kind: 'page',
                    id: page.id,
                    label: page.title || untitledDocument,
                  })
                }
              >
                <Icon iconName="description" $size="18px" />
                <span>{page.title || untitledDocument}</span>
                {page.parent?.title && (
                  <span className="loop-table__muted">{page.parent.title}</span>
                )}
              </button>
            ))}
        {onPickPage && !debounced.trim() && (
          <div className="loop-table__muted" style={{ padding: 6 }}>
            {t('Type to find a page too', {
              description: 'Hint of the mention picker of a text cell',
            })}
          </div>
        )}
      </div>
    </Popover>
  );
};
