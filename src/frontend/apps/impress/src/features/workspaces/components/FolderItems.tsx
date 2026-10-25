import { ReactNode } from 'react';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';

/**
 * Collaborators: a space as a folder, or a page as a document, on the
 * screen of a workspace or of a space.
 */
export const ItemCard = ({
  href,
  icon,
  title,
  details,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  details: string;
}) => (
  <StyledLink
    href={href}
    $css={css`
      display: flex;
      align-items: center;
      gap: var(--c--globals--spacings--sm);
      padding: var(--c--globals--spacings--sm);
      border: 1px solid var(--c--contextuals--border--surface--primary);
      border-radius: var(--c--globals--spacings--xs);
      color: inherit;
      text-decoration: none;
      background: var(--c--contextuals--background--surface--primary);
      transition: border-color 0.15s ease;
      &:hover {
        border-color: var(--c--globals--colors--brand-400, #8b8bf0);
      }
    `}
  >
    {icon}
    <Box $css="min-width: 0;">
      <Text $size="md" $weight="600" $ellipsis>
        {title}
      </Text>
      <Text $size="xs" $variation="secondary" $ellipsis>
        {details}
      </Text>
    </Box>
  </StyledLink>
);

/** A titled group of cards, with a button creating one more. */
export const Section = ({
  title,
  newLabel,
  onNew,
  empty,
  children,
  testId,
}: {
  title: string;
  newLabel: string;
  onNew?: () => void;
  empty: string | null;
  children: ReactNode;
  testId: string;
}) => (
  <Box as="section" $gap="sm" data-testid={testId}>
    <Box $direction="row" $align="center" $justify="space-between">
      <Text as="h2" $size="h6" $margin="none">
        {title}
      </Text>
      {onNew && (
        <BoxButton
          onClick={onNew}
          $direction="row"
          $align="center"
          $gap="3xs"
          $padding={{ horizontal: 'xs', vertical: '4xs' }}
          $css={css`
            border-radius: var(--c--globals--spacings--3xs);
            &:hover {
              background-color: var(
                --c--contextuals--background--semantic--contextual--primary
              );
            }
          `}
        >
          <Icon iconName="add" $size="18px" $variation="secondary" />
          <Text $size="sm" $variation="secondary">
            {newLabel}
          </Text>
        </BoxButton>
      )}
    </Box>
    {empty ? (
      <Text $size="sm" $variation="secondary">
        {empty}
      </Text>
    ) : (
      <Box
        $css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--c--globals--spacings--sm);
        `}
      >
        {children}
      </Box>
    )}
  </Box>
);
