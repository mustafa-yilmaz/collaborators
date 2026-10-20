import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';
import { GroupHoverCard } from '@/features/people/GroupHoverCard';
import { PersonHoverCard } from '@/features/people/PersonHoverCard';

import { PersonPicker } from './PersonPicker';
import { Popover } from './Popover';
import { RichCellEditor } from './RichCellEditor';
import { formatCell, labelOptionsOf } from './format';
import {
  PageRef,
  cellAnchor,
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
  toggleVote,
} from './model';
import { RichRun, formatTokenDate, runStyle, safeLink } from './richText';
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
  /** A text cell's formatting, when it has any */
  rich?: RichRun[];
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
  rich,
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
          <RichCellEditor
            table={table}
            tableId={tableId}
            docId={docId}
            rowId={rowId}
            column={column}
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
    content = <RichContent runs={rich ?? [{ text: value }]} />;
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

/** A Text cell's runs: formatted text, links and inline elements. */
const RichContent = ({ runs }: { runs: RichRun[] }) => {
  const { i18n } = useTranslation();
  return (
    <>
      {runs.map((run, runIndex) => {
        const parts = splitMentions(run.text).map((part, index) => {
          const key = `${runIndex}-${index}`;
          if (typeof part === 'string') {
            return part;
          }
          switch (part.kind) {
            case 'page':
              return (
                <PageChip
                  key={key}
                  page={{ kind: 'page', id: part.id, label: part.label }}
                />
              );
            case 'date':
              return (
                <span
                  key={key}
                  className="loop-table__chip loop-table__token is-date"
                >
                  {formatTokenDate(part.id, i18n.language)}
                </span>
              );
            case 'label':
              return <LabelChip key={key} label={part.label} color={part.id} />;
            case 'image':
              return (
                <img
                  key={key}
                  className="loop-table__inline-image"
                  src={part.id.replace(/%29/g, ')')}
                  alt={part.label}
                />
              );
            default:
              return (
                <PersonChips
                  key={key}
                  value={[{ kind: part.kind, id: part.id, label: part.label }]}
                />
              );
          }
        });
        const style = runStyle(run.marks);
        const href = run.marks?.link ? safeLink(run.marks.link) : null;
        if (href) {
          return (
            <a
              key={runIndex}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="loop-table__link"
              style={style}
              onClick={(event) => event.stopPropagation()}
            >
              {parts}
            </a>
          );
        }
        return style ? (
          <span key={runIndex} style={style}>
            {parts}
          </span>
        ) : (
          <Fragment key={runIndex}>{parts}</Fragment>
        );
      })}
    </>
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
      {people.map((person) => {
        const chip = (
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
          </span>
        );
        // Hovering a person shows their card; a group, who is in it
        return person.kind === 'group' ? (
          <GroupHoverCard key={person.id} team={person.id} name={person.label}>
            {chip}
          </GroupHoverCard>
        ) : (
          <PersonHoverCard
            key={person.id}
            userId={person.id}
            name={person.label}
          >
            {chip}
          </PersonHoverCard>
        );
      })}
    </>
  );
};
