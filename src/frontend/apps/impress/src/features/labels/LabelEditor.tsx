import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';

import { useLabelSuggestions, useOwnLabels } from './api';

/** Where a label's workspaces, spaces and pages are listed. */
export const labelHref = (name: string) =>
  `/labels/?name=${encodeURIComponent(name)}`;

const chipCss = css`
  border-radius: 999px;
  background: var(--c--contextuals--background--semantic--contextual--primary);
`;

/** A label, opening its page. */
export const LabelChip = ({
  name,
  onRemove,
  removeLabel,
}: {
  name: string;
  onRemove?: () => void;
  removeLabel?: string;
}) => (
  <Box
    $direction="row"
    $align="center"
    $gap="4xs"
    $padding={{ left: 'xs', right: onRemove ? '3xs' : 'xs', vertical: '4xs' }}
    $css={chipCss}
    data-testid={`label-${name}`}
  >
    <StyledLink href={labelHref(name)}>
      <Text $size="xs" $theme="brand">
        #{name}
      </Text>
    </StyledLink>
    {onRemove && (
      <BoxButton
        aria-label={removeLabel}
        title={removeLabel}
        $padding="4xs"
        onClick={onRemove}
      >
        <Icon iconName="close" $size="14px" $variation="secondary" />
      </BoxButton>
    )}
  </Box>
);

/**
 * The labels of a page, a space ("documents/<id>") or a workspace
 * ("workspaces/<id>"): chips, and for those who may, a field to add more,
 * suggesting the labels already used on the platform.
 */
export const LabelEditor = ({
  path,
  hideWhenEmpty = false,
}: {
  path: string;
  /** Nothing at all when there's no label and one can't add any */
  hideWhenEmpty?: boolean;
}) => {
  const { t } = useTranslation();
  const { query, update } = useOwnLabels(path);
  const [text, setText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const names = query.data?.names ?? [];
  const canEdit = !!query.data?.can_edit;
  const typed = text.trim().replace(/^#/, '');
  const { data: suggestions = [] } = useLabelSuggestions(typed, isAdding);
  const choices = suggestions.filter(
    (item) =>
      !names.some((name) => name.toLowerCase() === item.name.toLowerCase()),
  );

  if (!query.data || (hideWhenEmpty && !names.length && !canEdit)) {
    return null;
  }

  const save = (next: string[]) => update.mutate(next);
  const add = (name: string) => {
    const clean = name.trim().replace(/^#/, '');
    if (
      clean &&
      !names.some((other) => other.toLowerCase() === clean.toLowerCase())
    ) {
      save([...names, clean]);
    }
    setText('');
  };

  return (
    <Box
      $direction="row"
      $align="center"
      $gap="2xs"
      $css="flex-wrap: wrap;"
      data-testid="label-editor"
    >
      {names.map((name) => (
        <LabelChip
          key={name}
          name={name}
          onRemove={
            canEdit
              ? () => save(names.filter((other) => other !== name))
              : undefined
          }
          removeLabel={t('Remove the label {{name}}', {
            description: 'Button removing a label',
            name,
          })}
        />
      ))}
      {canEdit &&
        (isAdding ? (
          <Box $position="relative">
            <input
              autoFocus
              aria-label={t('Add a label', {
                description: 'Field adding a label',
              })}
              placeholder={t('Label…', {
                description: 'Placeholder of the label field',
              })}
              value={text}
              maxLength={40}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  add(text);
                }
                if (event.key === 'Escape') {
                  setIsAdding(false);
                  setText('');
                }
              }}
              onBlur={() => {
                // let a click on a suggestion land first
                setTimeout(() => setIsAdding(false), 150);
              }}
              style={{
                width: 140,
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 999,
                border:
                  '1px solid var(--c--contextuals--border--surface--primary)',
              }}
            />
            {choices.length > 0 && (
              <Box
                role="listbox"
                $position="absolute"
                $padding="3xs"
                $css={css`
                  top: calc(100% + 4px);
                  left: 0;
                  z-index: 20;
                  min-width: 180px;
                  max-height: 220px;
                  overflow-y: auto;
                  border-radius: var(--c--globals--spacings--xs);
                  border: 1px solid
                    var(--c--contextuals--border--surface--primary);
                  background: var(
                    --c--contextuals--background--surface--primary
                  );
                  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                `}
              >
                {choices.slice(0, 8).map((item) => (
                  <BoxButton
                    key={item.name}
                    role="option"
                    $direction="row"
                    $justify="space-between"
                    $gap="xs"
                    $padding={{ horizontal: 'xs', vertical: '3xs' }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => add(item.name)}
                  >
                    <Text $size="sm">#{item.name}</Text>
                    <Text $size="xs" $variation="secondary">
                      {item.count}
                    </Text>
                  </BoxButton>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <BoxButton
            $direction="row"
            $align="center"
            $gap="4xs"
            $padding={{ horizontal: 'xs', vertical: '4xs' }}
            $css="border-radius: 999px;"
            onClick={() => setIsAdding(true)}
          >
            <Icon iconName="sell" $size="14px" $variation="secondary" />
            <Text $size="xs" $variation="secondary">
              {names.length
                ? t('Add', { description: 'Button adding a label' })
                : t('Add labels', { description: 'Button adding labels' })}
            </Text>
          </BoxButton>
        ))}
      {update.isError && (
        <Text $size="xs" $theme="error" role="alert">
          {update.error.cause?.[0]}
        </Text>
      )}
    </Box>
  );
};
