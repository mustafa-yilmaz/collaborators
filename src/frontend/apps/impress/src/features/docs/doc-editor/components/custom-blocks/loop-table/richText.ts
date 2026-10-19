/**
 * Rich text in Text cells (T9). A Text cell is a Y.Text: its characters, and
 * its formatting as Yjs attributes (bold, italic, underline, strike, code,
 * colour, background, link), so several people can edit and format the same
 * cell at once. Mentions, linked pages, dates, labels and images are tokens
 * in the text ("@[Label](kind:id)", see mentions.ts), so that the plain text
 * (sorting, filtering, search, export) reads them too.
 *
 * While a cell is edited, its text is a small ProseMirror document: text
 * with marks, line breaks, and the tokens as atoms.
 */
import {
  DOMOutputSpec,
  Fragment,
  Mark,
  Node as PMNode,
  Schema,
} from '@tiptap/pm/model';
import type { CSSProperties } from 'react';
import * as Y from 'yjs';

import { InlineRef, mentionToken, splitMentions } from './mentions';
import { LABEL_COLORS } from './styles';

// -- Formatting

export interface RichMarks {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  code?: true;
  /** A colour name of TEXT_COLORS */
  color?: string;
  /** A colour name of TEXT_COLORS */
  background?: string;
  /** An http(s) or mailto address */
  link?: string;
}

export interface RichRun {
  text: string;
  marks?: RichMarks;
}

const FLAG_MARKS = ['bold', 'italic', 'underline', 'strike', 'code'] as const;
const VALUE_MARKS = ['color', 'background', 'link'] as const;
const MARK_KEYS = [...FLAG_MARKS, ...VALUE_MARKS];

/** The text and background colours offered, as in the page editor. */
export const TEXT_COLORS: Record<string, { text: string; background: string }> =
  {
    gray: { text: '#787774', background: '#f1f1ef' },
    brown: { text: '#9f6b53', background: '#f4eeee' },
    red: { text: '#d44c47', background: '#fbe4e4' },
    orange: { text: '#d9730d', background: '#fbecdd' },
    yellow: { text: '#cb912f', background: '#fbf3db' },
    green: { text: '#448361', background: '#edf3ec' },
    blue: { text: '#337ea9', background: '#e7f3f8' },
    purple: { text: '#9065b0', background: '#f6f3f9' },
    pink: { text: '#c14c8a', background: '#faf1f5' },
  };

/** Only links that are safe to open from a cell. */
export const safeLink = (href: string) => {
  const value = href.trim();
  if (!value) {
    return null;
  }
  if (/^(https?:|mailto:)/i.test(value)) {
    return value;
  }
  // "example.com" means a web address
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(value)) {
    return `https://${value}`;
  }
  return null;
};

/** The known marks of a Yjs attribute set, without empty ones. */
export const cleanMarks = (
  attributes?: Record<string, unknown> | null,
): RichMarks | undefined => {
  if (!attributes) {
    return undefined;
  }
  const marks: RichMarks = {};
  FLAG_MARKS.forEach((key) => {
    if (attributes[key]) {
      marks[key] = true;
    }
  });
  VALUE_MARKS.forEach((key) => {
    const value = attributes[key];
    if (typeof value === 'string' && value) {
      marks[key] = value;
    }
  });
  return Object.keys(marks).length ? marks : undefined;
};

const sameMarks = (a?: RichMarks, b?: RichMarks) =>
  MARK_KEYS.every((key) => (a?.[key] ?? null) === (b?.[key] ?? null));

/** Join neighbouring runs that look the same. */
export const mergeRuns = (runs: RichRun[]): RichRun[] =>
  runs.reduce<RichRun[]>((merged, run) => {
    if (!run.text) {
      return merged;
    }
    const last = merged[merged.length - 1];
    if (last && sameMarks(last.marks, run.marks)) {
      last.text += run.text;
    } else {
      merged.push(
        run.marks ? { text: run.text, marks: run.marks } : { text: run.text },
      );
    }
    return merged;
  }, []);

export const runsText = (runs: RichRun[]) =>
  runs.map((run) => run.text).join('');

export const hasMarks = (runs: RichRun[]) => runs.some((run) => run.marks);

// -- Yjs

type Delta = { insert?: unknown; attributes?: Record<string, unknown> }[];

/** The runs of a Text cell. */
export const readRuns = (text: Y.Text): RichRun[] =>
  mergeRuns(
    (text.toDelta() as Delta)
      .filter((op) => typeof op.insert === 'string')
      .map((op) => ({
        text: op.insert as string,
        marks: cleanMarks(op.attributes),
      })),
  );

/** The runs of a Text cell, when any of it is formatted. */
export const readRichCell = (text: Y.Text) => {
  const runs = readRuns(text);
  return hasMarks(runs) ? runs : undefined;
};

const yAttributes = (marks?: RichMarks) =>
  Object.fromEntries(MARK_KEYS.map((key) => [key, marks?.[key] ?? null]));

/**
 * Make a Text cell hold these runs with the fewest changes: the characters
 * that differ, then the formatting where it differs.
 */
export const writeRuns = (text: Y.Text, runs: RichRun[]) => {
  const apply = () => {
    const current = text.toString();
    const next = runsText(runs);
    if (current !== next) {
      let start = 0;
      while (
        start < current.length &&
        start < next.length &&
        current[start] === next[start]
      ) {
        start++;
      }
      let endCurrent = current.length;
      let endNext = next.length;
      while (
        endCurrent > start &&
        endNext > start &&
        current[endCurrent - 1] === next[endNext - 1]
      ) {
        endCurrent--;
        endNext--;
      }
      if (endCurrent > start) {
        text.delete(start, endCurrent - start);
      }
      if (endNext > start) {
        text.insert(start, next.slice(start, endNext), {});
      }
    }
    // Formatting: only the runs that differ from what is stored
    const stored = readRuns(text);
    const marksAt = (list: RichRun[]) => {
      const at: (RichMarks | undefined)[] = [];
      list.forEach((run) => {
        for (let i = 0; i < run.text.length; i++) {
          at.push(run.marks);
        }
      });
      return at;
    };
    const before = marksAt(stored);
    const after = marksAt(runs);
    let index = 0;
    while (index < after.length) {
      if (sameMarks(before[index], after[index])) {
        index++;
        continue;
      }
      let end = index + 1;
      while (
        end < after.length &&
        sameMarks(after[end], after[index]) &&
        !sameMarks(before[end], after[end])
      ) {
        end++;
      }
      text.format(index, end - index, yAttributes(after[index]));
      index = end;
    }
  };
  if (text.doc) {
    text.doc.transact(apply);
  } else {
    apply();
  }
};

// -- The editor's document

/** A date token, as "19 Oct 2026" in the reader's language. */
export const formatTokenDate = (iso: string, locale?: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Date(year, month - 1, day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/** How a token looks inside the cell editor. */
const tokenDOM = (ref: InlineRef): DOMOutputSpec => {
  const token = mentionToken(ref);
  if (ref.kind === 'image') {
    return [
      'img',
      {
        class: 'loop-table__inline-image',
        src: ref.id.replace(/%29/g, ')'),
        alt: ref.label,
        'data-token': token,
      },
    ];
  }
  const label =
    ref.kind === 'date'
      ? formatTokenDate(ref.id, document.documentElement.lang || undefined)
      : ref.kind === 'user' || ref.kind === 'group'
        ? `@${ref.label}`
        : ref.label;
  const colors = ref.kind === 'label' ? LABEL_COLORS[ref.id] : undefined;
  return [
    'span',
    {
      class: `loop-table__chip loop-table__token is-${ref.kind}`,
      'data-token': token,
      ...(colors
        ? { style: `background: ${colors.bg}; color: ${colors.fg}` }
        : {}),
    },
    label,
  ];
};

export const richSchema = new Schema({
  nodes: {
    doc: { content: 'inline*' },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
    // A mention, linked page, date, label or image
    token: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: {
        kind: { default: 'user' },
        id: { default: '' },
        label: { default: '' },
      },
      toDOM: (node) => tokenDOM(node.attrs as InlineRef),
    },
  },
  marks: {
    bold: { toDOM: () => ['strong', 0] },
    italic: { toDOM: () => ['em', 0] },
    underline: { toDOM: () => ['u', 0] },
    strike: { toDOM: () => ['s', 0] },
    code: { toDOM: () => ['code', 0] },
    color: {
      attrs: { value: {} },
      toDOM: (mark) => [
        'span',
        {
          style: `color: ${TEXT_COLORS[String(mark.attrs.value)]?.text ?? 'inherit'}`,
        },
        0,
      ],
    },
    background: {
      attrs: { value: {} },
      toDOM: (mark) => [
        'span',
        {
          style: `background-color: ${TEXT_COLORS[String(mark.attrs.value)]?.background ?? 'transparent'}`,
        },
        0,
      ],
    },
    link: {
      attrs: { href: {} },
      inclusive: false,
      toDOM: (mark) => [
        'a',
        { href: String(mark.attrs.href), class: 'loop-table__link' },
        0,
      ],
    },
  },
});

const toPMMarks = (marks?: RichMarks): Mark[] => {
  if (!marks) {
    return [];
  }
  const list: Mark[] = [];
  FLAG_MARKS.forEach((key) => {
    if (marks[key]) {
      list.push(richSchema.marks[key].create());
    }
  });
  if (marks.color) {
    list.push(richSchema.marks.color.create({ value: marks.color }));
  }
  if (marks.background) {
    list.push(richSchema.marks.background.create({ value: marks.background }));
  }
  if (marks.link) {
    list.push(richSchema.marks.link.create({ href: marks.link }));
  }
  return list;
};

const fromPMMarks = (marks: readonly Mark[]): RichMarks | undefined => {
  const result: RichMarks = {};
  marks.forEach((mark) => {
    const name = mark.type.name;
    if ((FLAG_MARKS as readonly string[]).includes(name)) {
      result[name as (typeof FLAG_MARKS)[number]] = true;
    } else if (name === 'color' || name === 'background') {
      result[name] = String(mark.attrs.value);
    } else if (name === 'link') {
      result.link = String(mark.attrs.href);
    }
  });
  return Object.keys(result).length ? result : undefined;
};

/** The editor's document for these runs. */
export const runsToDoc = (runs: RichRun[]): PMNode => {
  const nodes: PMNode[] = [];
  runs.forEach((run) => {
    const marks = toPMMarks(run.marks);
    run.text.split('\n').forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        nodes.push(richSchema.nodes.hard_break.create());
      }
      splitMentions(line).forEach((part) => {
        if (typeof part === 'string') {
          if (part) {
            nodes.push(richSchema.text(part, marks));
          }
        } else {
          nodes.push(richSchema.nodes.token.create(part, null, marks));
        }
      });
    });
  });
  return richSchema.nodes.doc.create(null, Fragment.fromArray(nodes));
};

/** The runs of the editor's document. */
export const docToRuns = (doc: PMNode): RichRun[] => {
  const runs: RichRun[] = [];
  doc.forEach((node) => {
    if (node.isText) {
      runs.push({ text: node.text ?? '', marks: fromPMMarks(node.marks) });
    } else if (node.type.name === 'hard_break') {
      runs.push({ text: '\n' });
    } else if (node.type.name === 'token') {
      runs.push({
        text: mentionToken(node.attrs as InlineRef),
        marks: fromPMMarks(node.marks),
      });
    }
  });
  return mergeRuns(runs);
};

/** Inline CSS for a run's marks, when shown in a cell. */
export const runStyle = (marks?: RichMarks): CSSProperties | undefined => {
  if (!marks) {
    return undefined;
  }
  const decorations = [
    marks.underline || marks.link ? 'underline' : '',
    marks.strike ? 'line-through' : '',
  ].filter(Boolean);
  return {
    fontWeight: marks.bold ? 600 : undefined,
    fontStyle: marks.italic ? 'italic' : undefined,
    textDecoration: decorations.length ? decorations.join(' ') : undefined,
    color: marks.color ? TEXT_COLORS[marks.color]?.text : undefined,
    backgroundColor: marks.background
      ? TEXT_COLORS[marks.background]?.background
      : undefined,
    fontFamily: marks.code ? 'monospace' : undefined,
  };
};
