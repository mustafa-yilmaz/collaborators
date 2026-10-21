import { StyleSchema, createExtension } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import { DropdownMenu } from '@gouvfr-lasuite/ui-components';
import { Plugin } from '@tiptap/pm/state';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';
import { GroupHoverCard } from '@/features/people/GroupHoverCard';
import { PersonHoverCard } from '@/features/people/PersonHoverCard';

import { searchOrigin } from '../Interlinking/searchSession';

/**
 * A mention of a collaborator or a group: "@Ada" or "@Q4 Launch".
 *
 * `targetId` is a user id, or a team string for a group (e.g. "group:<id>").
 * The backend reads these props in comment bodies to notify the people
 * mentioned; in pages, the mention is reported when it is inserted.
 *
 * `assign`: in a page, the person or group is assigned the block (see
 * usePageAssignments): set when mentioned in a to-do item, or from the
 * mention's menu in any block.
 */
export type MentionInlineContentType = {
  type: 'mention';
  propSchema: {
    kind: { default: 'user'; values: readonly ['user', 'group'] };
    targetId: { default: '' };
    label: { default: '' };
    assign: { default: false };
  };
  content: 'none';
};

const mentionConfig = {
  type: 'mention',
  propSchema: {
    kind: { default: 'user', values: ['user', 'group'] },
    targetId: { default: '' },
    label: { default: '' },
    assign: { default: false },
  },
  content: 'none',
} as const;

const MentionChip = ({
  kind,
  targetId,
  label,
  assign,
  onAssign,
}: {
  kind: 'user' | 'group';
  targetId: string;
  label: string;
  assign?: boolean;
  /** In an editable page: make the mention an assignment, or not */
  onAssign?: (assign: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
      {assign && (
        <Icon
          iconName="assignment_ind"
          $size="14px"
          $color="inherit"
          aria-label={t('Assigned', {
            description: 'Mark of a mention that is an assignment',
          })}
        />
      )}
      {kind === 'group' && (
        <Icon iconName="groups" $size="14px" $color="inherit" />
      )}
      @{label}
    </span>
  );
  // In an editable page, the mention's menu makes it an assignment
  const withMenu = onAssign ? (
    <DropdownMenu
      isOpen={isMenuOpen}
      onOpenChange={setIsMenuOpen}
      options={[
        assign
          ? {
              label: t('Remove the assignment', {
                description: 'Menu of a mention that is an assignment',
              }),
              icon: <Icon iconName="assignment_return" $size="18px" />,
              callback: () => onAssign(false),
            }
          : {
              label: t('Assign this to {{name}}', {
                description: 'Menu of a mention in a page',
                name: label,
              }),
              icon: <Icon iconName="assignment_ind" $size="18px" />,
              callback: () => onAssign(true),
            },
      ]}
    >
      <span
        role="button"
        tabIndex={-1}
        onClick={() => setIsMenuOpen(true)}
        style={{ cursor: 'pointer' }}
      >
        {chip}
      </span>
    </DropdownMenu>
  ) : (
    chip
  );
  // Hovering a person shows their card; a group, who is in it
  return kind === 'user' ? (
    <PersonHoverCard userId={targetId} name={label}>
      {withMenu}
    </PersonHoverCard>
  ) : (
    <GroupHoverCard team={targetId} name={label}>
      {withMenu}
    </GroupHoverCard>
  );
};

type MentionProps = {
  kind: 'user' | 'group';
  targetId: string;
  label: string;
  assign: boolean;
};

const renderWith = (canAssign: boolean) => ({
  render: ({
    inlineContent,
    updateInlineContent,
    editor,
  }: {
    inlineContent: { type: 'mention'; props: MentionProps };
    updateInlineContent: (update: {
      type: 'mention';
      props: MentionProps;
    }) => void;
    editor: { isEditable: boolean };
  }) => (
    <MentionChip
      kind={inlineContent.props.kind}
      targetId={inlineContent.props.targetId}
      label={inlineContent.props.label}
      assign={inlineContent.props.assign}
      onAssign={
        canAssign && editor.isEditable
          ? (assign) =>
              updateInlineContent({
                type: 'mention',
                props: { ...inlineContent.props, assign },
              })
          : undefined
      }
    />
  ),
  toExternalHTML: ({
    inlineContent,
  }: {
    inlineContent: { props: { label: string } };
  }) => <span>@{inlineContent.props.label}</span>,
});

/** The mention chip, for the page editor (its "@" is handled by useShortcuts). */
export const MentionInlineContent = createReactInlineContentSpec<
  MentionInlineContentType,
  StyleSchema
>(mentionConfig, renderWith(true));

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
>(mentionConfig, renderWith(false), [mentionTriggerExtension()]);
