import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import { PersonPicker } from './PersonPicker';
import { Popover } from './Popover';
import { formatCell, labelOptionsOf } from './format';
import {
  PageRef,
  cellAnchor,
  mentionToken,
  notifyCell,
  plainText,
  splitMentions,
  syncAssignments,
} from './mentions';
import {
  CellValue,
  Column,
  ColumnType,
  PersonValue,
  TableSnapshot,
  setCellValue,
  setTextCell,
  toggleVote,
} from './model';
import { LABEL_COLORS } from './styles';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'next' | 'prev';

interface CellProps {
  table: Y.Map<unknown>;
  tableId: string;
  snapshot: TableSnapshot;
  column: Column;
  rowId: string;
  value: CellValue;
  docId: string;
  userId?: string;
  isEditable: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  /** Leave editing, optionally moving the active cell. */
  onStopEdit: (move?: Direction) => void;
}

const LabelChip = ({ label, color }: { label: string; color: string }) => {
  const colors = LABEL_COLORS[color] ?? LABEL_COLORS.gray;
  return (
    <span
      className="loop-table__chip"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {label}
    </span>
  );
};

/** Keys that leave a cell editor, and where they move. */
const editorKeyMove = (
  event: React.KeyboardEvent,
  multiline: boolean,
): Direction | 'stay' | null => {
  if (event.key === 'Escape') {
    return 'stay';
  }
  if (event.key === 'Tab') {
    return event.shiftKey ? 'prev' : 'next';
  }
  if (event.key === 'Enter' && !(multiline && event.shiftKey)) {
    return 'down';
  }
  return null;
};

const TextEditor = ({
  table,
  tableId,
  docId,
  rowId,
  column,
  initial,
  onStopEdit,
}: {
  table: Y.Map<unknown>;
  tableId: string;
  docId: string;
  rowId: string;
  column: Column;
  initial: string;
  onStopEdit: CellProps['onStopEdit'];
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(initial);
  const [isPicking, setIsPicking] = useState(false);
  const caretRef = useRef(0);

  // "@" at the start of a word opens the people and groups picker
  const insertMention = (person: PersonValue | PageRef) => {
    const at = caretRef.current;
    const next = `${draft.slice(0, at)}${mentionToken(person)} ${draft.slice(at)}`;
    setDraft(next);
    setTextCell(table, rowId, column.id, next);
    setIsPicking(false);
    // People and groups are notified; a linked page has no one to tell
    if (docId && person.kind !== 'page') {
      void notifyCell(
        docId,
        cellAnchor(tableId, rowId, column.id),
        person,
        'mention',
      ).catch(() => undefined);
    }
    requestAnimationFrame(() => ref.current?.focus());
  };

  // Show the edits other people make to the same cell while I edit it
  useEffect(() => {
    if (ref.current !== document.activeElement || draft === initial) {
      return;
    }
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    const element = ref.current;
    if (element) {
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
    }
  }, []);

  return (
    <>
      <textarea
        ref={ref}
        className="loop-table__input"
        rows={Math.max(1, draft.split('\n').length)}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setTextCell(table, rowId, column.id, event.target.value);
        }}
        onBlur={() => !isPicking && onStopEdit()}
        onKeyDown={(event) => {
          if (event.key === '@') {
            const element = event.currentTarget;
            const at = element.selectionStart ?? element.value.length;
            const before = element.value.slice(Math.max(0, at - 1), at);
            if (!before || /\s/.test(before)) {
              event.preventDefault();
              caretRef.current = at;
              setIsPicking(true);
              return;
            }
          }
          const move = editorKeyMove(event, true);
          if (move) {
            event.preventDefault();
            onStopEdit(move === 'stay' ? undefined : move);
          }
        }}
      />
      {isPicking && (
        <PersonPicker
          docId={docId}
          value={[]}
          onChange={(people) => people[0] && insertMention(people[0])}
          onPickPage={insertMention}
          onClose={() => {
            setIsPicking(false);
            requestAnimationFrame(() => ref.current?.focus());
          }}
        />
      )}
    </>
  );
};

const NumberEditor = ({
  initial,
  onCommit,
  onStopEdit,
}: {
  initial: number | null;
  onCommit: (value: number | null) => void;
  onStopEdit: CellProps['onStopEdit'];
}) => {
  const [draft, setDraft] = useState(initial === null ? '' : String(initial));
  const commit = () => {
    const text = draft.trim().replace(',', '.');
    const number = parseFloat(text);
    onCommit(text === '' || !Number.isFinite(number) ? null : number);
  };
  return (
    <input
      autoFocus
      inputMode="decimal"
      className="loop-table__input"
      style={{ textAlign: 'right' }}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        commit();
        onStopEdit();
      }}
      onKeyDown={(event) => {
        const move = editorKeyMove(event, false);
        if (move) {
          event.preventDefault();
          if (move !== 'stay') {
            commit();
          }
          onStopEdit(move === 'stay' ? undefined : move);
        }
      }}
    />
  );
};

/** What a row is about, for assignments: its first non-empty text. */
const rowLabel = (snapshot: TableSnapshot, rowId: string) => {
  const row = snapshot.rows.find((item) => item.id === rowId);
  const textColumn = snapshot.columns.find(
    (column) =>
      column.type === ColumnType.TEXT &&
      typeof row?.cells[column.id] === 'string' &&
      row.cells[column.id] !== '',
  );
  return textColumn && row ? plainText(String(row.cells[textColumn.id])) : '';
};

export const Cell = ({
  table,
  tableId,
  snapshot,
  column,
  rowId,
  value,
  docId,
  userId,
  isEditable,
  isEditing,
  onStartEdit,
  onStopEdit,
}: CellProps) => {
  const { t } = useTranslation();

  // -- Voting can be used without "editing" the cell
  if (column.type === ColumnType.VOTING) {
    const voters = Array.isArray(value) ? (value as string[]) : [];
    const voted = !!userId && voters.includes(userId);
    return (
      <div className="loop-table__cell">
        <button
          type="button"
          className={`loop-table__vote ${voted ? 'is-voted' : ''}`}
          disabled={!isEditable || !userId}
          aria-pressed={voted}
          aria-label={t('Vote, {{count}} votes', {
            description: 'Accessible name of a voting cell',
            count: voters.length,
          })}
          title={
            voted
              ? t('You voted. Click to remove your vote.', {
                  description: 'Tooltip of a voting cell',
                })
              : t('Click to vote', {
                  description: 'Tooltip of a voting cell',
                })
          }
          onClick={() => userId && toggleVote(table, rowId, column.id, userId)}
        >
          <Icon iconName="thumb_up" $size="14px" />
          {voters.length}
        </button>
      </div>
    );
  }

  // -- Editors
  if (isEditing && isEditable) {
    switch (column.type) {
      case ColumnType.TEXT:
        return (
          <TextEditor
            table={table}
            tableId={tableId}
            docId={docId}
            rowId={rowId}
            column={column}
            initial={typeof value === 'string' ? value : ''}
            onStopEdit={onStopEdit}
          />
        );
      case ColumnType.NUMBER:
        return (
          <NumberEditor
            initial={typeof value === 'number' ? value : null}
            onCommit={(number) => setCellValue(table, rowId, column.id, number)}
            onStopEdit={onStopEdit}
          />
        );
      case ColumnType.DATE:
        return (
          <input
            autoFocus
            type="date"
            className="loop-table__input"
            defaultValue={typeof value === 'string' ? value : ''}
            onChange={(event) =>
              setCellValue(table, rowId, column.id, event.target.value || null)
            }
            onBlur={() => onStopEdit()}
            onKeyDown={(event) => {
              const move = editorKeyMove(event, false);
              if (move) {
                event.preventDefault();
                onStopEdit(move === 'stay' ? undefined : move);
              }
            }}
          />
        );
      case ColumnType.LABEL: {
        const options = labelOptionsOf(column, snapshot);
        return (
          <div className="loop-table__cell">
            {formatCell(column, value, snapshot) || ' '}
            <Popover
              onClose={() => onStopEdit()}
              label={t('Choose a label', {
                description: 'Accessible name of the label picker',
              })}
            >
              {options.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  autoFocus={index === 0}
                  className="loop-table__popover-item"
                  onClick={() => {
                    setCellValue(table, rowId, column.id, option.id);
                    onStopEdit();
                  }}
                >
                  <LabelChip label={option.label} color={option.color} />
                  {value === option.id && (
                    <Icon iconName="check" $size="16px" />
                  )}
                </button>
              ))}
              <button
                type="button"
                className="loop-table__popover-item"
                onClick={() => {
                  setCellValue(table, rowId, column.id, null);
                  onStopEdit();
                }}
              >
                <span className="loop-table__muted">
                  {t('No label', { description: 'Clears a label cell' })}
                </span>
              </button>
            </Popover>
          </div>
        );
      }
      case ColumnType.PERSON:
        return (
          <div className="loop-table__cell">
            <PersonChips value={value} />
            <PersonPicker
              docId={docId}
              value={Array.isArray(value) ? (value as PersonValue[]) : []}
              onChange={(people) => {
                const before = Array.isArray(value)
                  ? (value as PersonValue[])
                  : [];
                setCellValue(table, rowId, column.id, people);
                // Assigning someone (or a group) notifies them and lists the
                // row on their dashboard; removing them takes it off
                if (docId) {
                  syncAssignments(
                    docId,
                    cellAnchor(tableId, rowId, column.id),
                    before,
                    people,
                    rowLabel(snapshot, rowId),
                  );
                }
              }}
              onClose={() => onStopEdit()}
            />
          </div>
        );
    }
  }

  // -- Display
  const isNumber = column.type === ColumnType.NUMBER;
  let content: React.ReactNode = formatCell(column, value, snapshot);
  if (column.type === ColumnType.LABEL && value) {
    const option = labelOptionsOf(column, snapshot).find(
      (item) => item.id === value,
    );
    content = option ? (
      <LabelChip label={option.label} color={option.color} />
    ) : null;
  }
  if (column.type === ColumnType.PERSON) {
    content = <PersonChips value={value} />;
  }
  if (column.type === ColumnType.TEXT && typeof value === 'string') {
    content = splitMentions(value).map((part, index) =>
      typeof part === 'string' ? (
        part
      ) : part.kind === 'page' ? (
        <PageChip key={index} page={part} />
      ) : (
        <PersonChips key={index} value={[part]} />
      ),
    );
  }

  return (
    <div
      className={`loop-table__cell ${isNumber ? 'is-number' : ''}`}
      onDoubleClick={() => isEditable && onStartEdit()}
    >
      {content || ' '}
    </div>
  );
};

/** A page linked from a cell: its title, opening it on click. */
const PageChip = ({ page }: { page: PageRef }) => (
  <a
    href={`/docs/${page.id}/`}
    className="loop-table__chip"
    style={{ background: '#E3EDF8', color: '#1F4E8C', textDecoration: 'none' }}
    title={page.label}
    onClick={(event) => event.stopPropagation()}
  >
    <Icon iconName="description" $size="14px" />
    {page.label}
  </a>
);

const PersonChips = ({ value }: { value: CellValue }) => {
  const people = Array.isArray(value) ? (value as PersonValue[]) : [];
  return (
    <>
      {people.map((person) => (
        <span
          key={person.id}
          className="loop-table__chip"
          style={{ background: '#ECE6FB', color: '#4F3497' }}
          title={person.label}
        >
          <Icon
            iconName={person.kind === 'group' ? 'groups' : 'person'}
            $size="14px"
          />
          {person.label}
        </span>
      ))}
    </>
  );
};
