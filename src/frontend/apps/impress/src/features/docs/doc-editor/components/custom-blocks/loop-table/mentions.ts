/**
 * Mentions inside Text cells, written in the cell's text as
 * "@[Label](user:<id>)" or "@[Label](group:<team>)", so they travel with the
 * collaborative text. They are shown as chips, and exported and searched as
 * "@Label".
 */
import { postMention } from '@/features/notifications/api';

import { PersonValue } from './model';

export const MENTION_TOKEN_RE = /@\[([^\]]+)\]\((user|group):([^)]+)\)/g;

export const mentionToken = (person: PersonValue) =>
  `@[${person.label.replace(/[[\]]/g, '')}](${person.kind}:${person.id})`;

export type TextPart = string | PersonValue;

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
      kind: match[2] as PersonValue['kind'],
      id: match[3],
    });
    last = index + match[0].length;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
};

/** A cell's text with its mentions as "@Label". */
export const plainText = (text: string) =>
  text.replace(MENTION_TOKEN_RE, (_match, label: string) => `@${label}`);

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
