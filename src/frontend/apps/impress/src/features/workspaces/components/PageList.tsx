import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import {
  Doc,
  KEY_LIST_DOC,
  useCreateDoc,
} from '@/features/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel/stores';
import { useResponsiveStore } from '@/stores';

const PAGES_SHOWN = 30;

/** My independent pages: in no space, nor under another page. */
const useIndependentPages = () =>
  useQuery<APIList<Doc>, APIError>({
    queryKey: [KEY_LIST_DOC, 'independent'],
    queryFn: async () => {
      const response = await fetchAPI(
        `documents/?independent=true&ordering=-updated_at&page_size=${PAGES_SHOWN}`,
      );
      if (!response.ok) {
        throw new APIError(
          'Failed to get the pages',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<APIList<Doc>>;
    },
  });

/**
 * The pages belonging to no space or workspace, under "My spaces & pages",
 * with a button creating one.
 */
export const PageList = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const { data, isLoading } = useIndependentPages();
  const pages = data?.results ?? [];
  const { mutate: createPage, isPending } = useCreateDoc({
    onSuccess: (doc) => {
      void router.push(`/docs/${doc.id}/`);
      if (isMobile) {
        closePanel();
      }
    },
  });

  return (
    <Box
      $padding={{ horizontal: 'sm' }}
      $gap="3xs"
      className="--collaborators--page-list"
    >
      <Box
        $direction="row"
        $align="center"
        $justify="space-between"
        $padding={{ horizontal: '2xs' }}
      >
        <Text
          as="h2"
          $size="xs"
          $weight="600"
          $variation="secondary"
          $margin="none"
        >
          {t('Pages', {
            description: 'Heading of the pages outside any space',
          })}
        </Text>
        <BoxButton
          onClick={() => !isPending && createPage({})}
          aria-label={t('New page', {
            description: 'Button creating a page outside any space',
          })}
          title={t('New page', {
            description: 'Button creating a page outside any space',
          })}
          data-testid="new-independent-page"
          $padding="4xs"
          $css="border-radius: 4px;"
        >
          <Icon iconName="add" $size="20px" $variation="secondary" />
        </BoxButton>
      </Box>

      {!isLoading && pages.length === 0 && (
        <Text
          $size="sm"
          $variation="secondary"
          $padding={{ horizontal: '2xs' }}
        >
          {t('Pages of your own, outside any space, appear here.', {
            description: 'Shown when the user has no page outside spaces',
          })}
        </Text>
      )}

      {pages.map((page) => (
        <StyledLink
          key={page.id}
          href={`/docs/${page.id}/`}
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
            &:focus-visible {
              outline: none !important;
              box-shadow: 0 0 0 2px ${colorsTokens['brand-400']} !important;
            }
          `}
        >
          <Icon iconName="description" $size="20px" $variation="tertiary" />
          <Text $size="sm" $weight="500" $ellipsis $css="min-width: 0;">
            {page.title ||
              t('Untitled page', {
                description: 'Name of a page without title',
              })}
          </Text>
        </StyledLink>
      ))}
    </Box>
  );
};
