import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Popover } from './Popover';
import { newId, upsertLabelGroup } from './model';
import { LABEL_COLORS } from './styles';

const COLORS = Object.keys(LABEL_COLORS);

interface LabelGroupEditorProps {
  table: Y.Map<unknown>;
  onCreated: (groupId: string) => void;
  onClose: () => void;
}

/** Create a custom label group: a name and one option per line. */
export const LabelGroupEditor = ({
  table,
  onCreated,
  onClose,
}: LabelGroupEditorProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [lines, setLines] = useState('');
  const options = lines
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <Popover
      onClose={onClose}
      label={t('New label group', { description: 'Loop table labels' })}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <input
          autoFocus
          placeholder={t('Group name, e.g. Status', {
            description: 'Placeholder of a label group name',
          })}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <textarea
          rows={4}
          placeholder={t('One label per line', {
            description: 'Placeholder of label group options',
          })}
          value={lines}
          onChange={(event) => setLines(event.target.value)}
          style={{
            font: 'inherit',
            fontSize: 13,
            padding: 6,
            border: '1px solid var(--lt-border)',
            borderRadius: 4,
          }}
        />
        <button
          type="button"
          className="loop-table__popover-item"
          disabled={!name.trim() || !options.length}
          onClick={() => {
            const groupId = newId();
            table.doc?.transact(() =>
              upsertLabelGroup(table, {
                id: groupId,
                name: name.trim(),
                options: options.map((label, index) => ({
                  id: newId(),
                  label,
                  color: COLORS[index % COLORS.length],
                })),
              }),
            );
            onCreated(groupId);
            onClose();
          }}
        >
          {t('Create labels', { description: 'Button creating a label group' })}
        </button>
      </div>
    </Popover>
  );
};
