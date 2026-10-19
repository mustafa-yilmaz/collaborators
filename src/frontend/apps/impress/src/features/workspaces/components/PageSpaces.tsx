import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { Doc } from '@/features/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel/stores';
import { useResponsiveStore } from '@/stores';

import { useLinkedPages, usePageMoves, usePageSpaceLinks } from '../api';

const chipCss = css`
  border-radius: 999px;
  border: 1px solid var(--c--contextuals--border--surface--primary);
`;

/** Under a page's title: the other spaces it is shown in. */
export const PageAlsoIn = ({ doc }: { doc: Doc }) => {
  const { t } = useTranslation();
  const isPage = doc.kind !== 'space';
  const { data } = usePageSpaceLinks(doc.id, isPage);
  const { unlink } = usePageMoves(doc.id);

  if (!isPage || !data?.links.length) {
    return null;
  }

  return (
    <Box
      $direction="row"
      $align="center"
      $gap="2xs"
      $css="flex-wrap: wrap;"
      data-testid="page-also-in"
    >
      <Text $size="xs" $variation="secondary">
        {t('Also in:', {
          description: 'Before the other spaces a page is shown in',
        })}
      </Text>
      {data.links.map((link) => (
        <Box
          key={link.id}
          $direction="row"
          $align="center"
          $gap="4xs"
          $padding={{ left: 'xs', right: '3xs', vertical: '4xs' }}
          $css={chipCss}
        >
          <StyledLink href={`/docs/${link.space.id}/`}>
            <Text $size="xs">
              {link.space.title ||
                t('Untitled space', {
                  description: 'Name of a space without title',
                })}
            </Text>
          </StyledLink>
          {link.can_unlink && (
            <BoxButton
              aria-label={t('Remove from {{space}}', {
                description:
                  'Button removing a page from a space it is shown in',
                space: link.space.title,
              })}
              title={t('Remove from {{space}}', {
                description:
                  'Button removing a page from a space it is shown in',
                space: link.space.title,
              })}
              $padding="4xs"
              onClick={() => unlink.mutate({ linkId: link.id })}
            >
              <Icon iconName="close" $size="14px" $variation="secondary" />
            </BoxButton>
          )}
        </Box>
      ))}
    </Box>
  );
};

/** Under a space's tree: the pages of elsewhere shown in it. */
export const SpaceLinkedPages = ({ space }: { space: Doc }) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const isSpace = space.kind === 'space';
  const { data: pages = [] } = useLinkedPages(space.id, isSpace);

  if (!isSpace || !pages.length) {
    return null;
  }

  return (
    <Box
      $padding={{ horizontal: 'sm', vertical: 'xs' }}
      $gap="3xs"
      data-testid="space-linked-pages"
    >
      <Text
        as="h2"
        $size="xs"
        $weight="600"
        $variation="secondary"
        $margin="none"
        $padding={{ horizontal: '2xs' }}
      >
        {t('Linked pages', {
          description: 'Heading of the pages of elsewhere shown in a space',
        })}
      </Text>
      {pages.map((item) => (
        <StyledLink
          key={item.link_id}
          href={`/docs/${item.page.id}/`}
          onClick={() => isMobile && closePanel()}
          $css={css`
            align-items: center;
            gap: var(--c--globals--spacings--2xs);
            padding: var(--c--globals--spacings--2xs);
            border-radius: var(--c--globals--spacings--3xs);
            color: inherit;
            text-decoration: none;
            &:hover {
              background-color: var(
                --c--contextuals--background--semantic--contextual--primary
              );
            }
          `}
        >
          <Icon iconName="link" $size="20px" $variation="tertiary" />
          <Box $flex={1} $css="min-width: 0;">
            <Text $size="sm" $weight="500" $ellipsis>
              {item.page.title ||
                t('Untitled page', {
                  description: 'Name of a page without title',
                })}
            </Text>
            <Text $size="xs" $variation="secondary" $ellipsis>
              {item.home
                ? t('Linked from {{space}}', {
                    description: 'Where a page shown in a space lives',
                    space: item.home.title,
                  })
                : t('Linked independent page', {
                    description: 'A page of no space shown in a space',
                  })}
            </Text>
          </Box>
        </StyledLink>
      ))}
    </Box>
  );
};
