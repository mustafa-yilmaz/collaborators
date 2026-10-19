import { createInlineContentSpec } from '@blocknote/core';

// Must stay in sync with the frontend MentionInlineContent
// (custom-inline-content/Mention/MentionInlineContent.tsx).
export const MentionInline = createInlineContentSpec(
  {
    type: 'mention' as const,
    propSchema: {
      kind: { default: 'user' as const, values: ['user', 'group'] as const },
      targetId: { default: '' },
      label: { default: '' },
    },
    content: 'none' as const,
  },
  {
    render: (inlineContent) => {
      const dom = document.createElement('span');
      dom.setAttribute('data-inline-content-type', 'mention');
      dom.textContent = `@${inlineContent.props.label}`;
      return { dom };
    },
  },
);
