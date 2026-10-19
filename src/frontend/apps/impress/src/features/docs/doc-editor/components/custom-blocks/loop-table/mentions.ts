/**
 * Mentions and other inline elements of Text cells, written in the cell's
 * text as "@[Label](kind:<id>)", so they travel with the collaborative text:
 * - "@[Label](user:<id>)", "@[Label](group:<team>)": a person or a group;
 * - "@[Title](page:<id>)": a linked page;
 * - "@[2026-10-19](date:2026-10-19)": a date;
 * - "@[Text](label:<colour>)": a coloured label;
 * - "@[Name](image:<address>)": a small image.
 * They are shown as chips, and exported and searched as "@Label" (a page,
 * date or label as its text, an image as its name).
 */
import { fetchAPI } from '@/api';
import { postMention } from '@/features/notifications/api';

import type { PersonValue } from './model';

export const MENTION_TOKEN_RE =
  /@\[([^\]]+)\]\((user|group|page|date|label|image):([^)]+)\)/g;

/** A page linked from a cell. */
export interface PageRef {
  kind: 'page';
  id: string;
  label: string;
}

/** Any inline element of a Text cell. */
export interface InlineRef {
  kind: 'user' | 'group' | 'page' | 'date' | 'label' | 'image';
  /** A user, team or page id, an ISO date, a colour name or an address */
  id: string;
  label: string;
}

export const mentionToken = (item: InlineRef) =>
  `@[${item.label.replace(/[[\]]/g, '') || ' '}](${item.kind}:${item.id.replace(/\)/g, '%29')})`;

export type TextPart = string | InlineRef;

/** Split a cell's text into plain text and mentions. */
export const splitMentions = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push(text.slice(last, index));
    }
    parts.push({
      label: match[1],
      kind: match[2] as InlineRef['kind'],
      id: match[3],
    });
    last = index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
};

/** A cell's text with its mentions as "@Label" (other elements as text). */
export const plainText = (text: string) =>
  text.replace(MENTION_TOKEN_RE, (_match, label: string, kind: string) =>
    kind === 'user' || kind === 'group' ? `@${label}` : label,
  );

export const cellAnchor = (tableId: string, rowId: string, columnId: string) =>
  `cell:${tableId}:${rowId}:${columnId}`;

/** Notify a person or a group mentioned, or assigned, in a cell. */
export const notifyCell = (
  docId: string,
  anchorId: string,
  person: PersonValue,
  reason: 'mention' | 'assignment',
) =>
  postMention({
    docId,
    anchorId,
    target: { kind: person.kind, id: person.id },
    reason,
  });

/**
 * Keep the server's index of table assignments in step with a Person cell:
 * someone added is recorded (and notified once), someone removed is dropped.
 */
export const syncAssignments = (
  docId: string,
  anchorId: string,
  before: PersonValue[],
  after: PersonValue[],
  rowLabel: string,
) => {
  const target = (person: PersonValue) =>
    person.kind === 'group' ? { team: person.id } : { assignee_id: person.id };
  const send = (method: 'POST' | 'DELETE', person: PersonValue) =>
    fetchAPI(`documents/${docId}/assignments/`, {
      method,
      body: JSON.stringify({
        anchor_id: anchorId,
        row_label: rowLabel.slice(0, 255),
        ...target(person),
      }),
    }).catch(() => undefined);

  const beforeIds = before.map((person) => person.id);
  const afterIds = after.map((person) => person.id);
  after
    .filter((person) => !beforeIds.includes(person.id))
    .forEach((person) => void send('POST', person));
  before
    .filter((person) => !afterIds.includes(person.id))
    .forEach((person) => void send('DELETE', person));
};
