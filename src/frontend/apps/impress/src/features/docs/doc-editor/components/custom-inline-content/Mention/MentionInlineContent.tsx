import { StyleSchema, createExtension } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import { Plugin } from '@tiptap/pm/state';

import { Icon } from '@/components';
import { PersonHoverCard } from '@/features/people/PersonHoverCard';

import { searchOrigin } from '../Interlinking/searchSession';

/**
 * A mention of a collaborator or a group: "@Ada" or "@Q4 Launch".
 *
 * `targetId` is a user id, or a team string for a group (e.g. "group:<id>").
 * The backend reads these props in comment bodies to notify the people
 * mentioned; in pages, the mention is reported when it is inserted.
 */
export type MentionInlineContentType = {
  type: 'mention';
  propSchema: {
    kind: { default: 'user'; values: readonly ['user', 'group'] };
    targetId: { default: '' };
    label: { default: '' };
  };
  content: 'none';
};

const mentionConfig = {
  type: 'mention',
  propSchema: {
    kind: { default: 'user', values: ['user', 'group'] },
    targetId: { default: '' },
    label: { default: '' },
  },
  content: 'none',
} as const;

const MentionChip = ({
  kind,
  targetId,
  label,
}: {
  kind: 'user' | 'group';
  targetId: string;
  label: string;
}) => {
  const chip = (
    <span
      className="--collaborators--mention"
      data-mention-kind={kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 6px',
        borderRadius: 999,
        background:
          'var(--c--contextuals--background--semantic--brand--tertiary, #ECE6FB)',
        color: 'var(--c--globals--colors--brand-700, #4F3497)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {kind === 'group' && (
        <Icon iconName="groups" $size="14px" $color="inherit" />
      )}
      @{label}
    </span>
  );
  // Hovering a person shows their card
  return kind === 'user' ? (
    <PersonHoverCard userId={targetId} name={label}>
      {chip}
    </PersonHoverCard>
  ) : (
    chip
  );
};

const render = {
  render: ({
    inlineContent,
  }: {
    inlineContent: {
      props: { kind: 'user' | 'group'; targetId: string; label: string };
    };
  }) => (
    <MentionChip
      kind={inlineContent.props.kind}
      targetId={inlineContent.props.targetId}
      label={inlineContent.props.label}
    />
  ),
  toExternalHTML: ({
    inlineContent,
  }: {
    inlineContent: { props: { label: string } };
  }) => <span>@{inlineContent.props.label}</span>,
};

/** The mention chip, for the page editor (its "@" is handled by useShortcuts). */
export const MentionInlineContent = createReactInlineContentSpec<
  MentionInlineContentType,
  StyleSchema
>(mentionConfig, render);

/**
 * Typing "@" (at the start of a word) opens the search for people, groups
 * and pages, in editors that don't have the page editor's shortcuts.
 */
const mentionTriggerExtension = createExtension(({ editor }) => ({
  key: 'mention-trigger',
  prosemirrorPlugins: [
    new Plugin({
      props: {
        handleKeyDown: (view, event) => {
          if (event.key !== '@') {
            return false;
          }
          const { $from } = view.state.selection;
          const before = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset,
            undefined,
            '￼',
          );
          if (before && before !== ' ') {
            return false;
          }
          editor.insertInlineContent([
            {
              type: 'interlinkingLinkInline',
              props: { trigger: '@', ...searchOrigin() },
            },
          ] as never);
          return true;
        },
      },
    }),
  ],
}));

/** The mention chip with its own "@" trigger, for the comment editor. */
export const MentionWithTriggerInlineContent = createReactInlineContentSpec<
  MentionInlineContentType,
  StyleSchema
>(mentionConfig, render, [mentionTriggerExtension()]);
