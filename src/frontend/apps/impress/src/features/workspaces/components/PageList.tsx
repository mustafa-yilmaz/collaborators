import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useState } from 'react';
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

import { usePageMoves, useSpaces } from '../api';

const PAGES_SHOWN = 30;

/** My independent pages: in no space, nor under another page. */
const useIndependentPages = (enabled: boolean) =>
  useQuery<APIList<Doc>, APIError>({
    enabled,
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

/** Puts a page just created directly in the workspace, then opens it. */
const PlaceInWorkspace = ({
  pageId,
  workspaceId,
  onDone,
}: {
  pageId: string;
  workspaceId: string;
  onDone: () => void;
}) => {
  const { moveToWorkspace } = usePageMoves(pageId);
  if (moveToWorkspace.isIdle) {
    moveToWorkspace.mutate({ workspaceId }, { onSettled: onDone });
  }
  return null;
};

/**
 * The pages outside any space: under "My spaces & pages", those belonging
 * to no workspace either; in a workspace, those placed directly in it. With
 * a button creating one there.
 */
export const PageList = ({ workspaceId }: { workspaceId?: string }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const independent = useIndependentPages(!workspaceId);
  const inWorkspace = useSpaces(
    { workspaceId: workspaceId ?? '', pages: true },
    !!workspaceId,
  );
  const isLoading = workspaceId ? inWorkspace.isLoading : independent.isLoading;
  const pages: { id: string; title?: string | null }[] =
    (workspaceId ? inWorkspace.data : independent.data?.results) ?? [];
  const [placing, setPlacing] = useState<string>();
  const open = (pageId: string) => {
    void router.push(`/docs/${pageId}/`);
    if (isMobile) {
      closePanel();
    }
  };
  const { mutate: createPage, isPending } = useCreateDoc({
    onSuccess: (doc) => (workspaceId ? setPlacing(doc.id) : open(doc.id)),
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

      {placing && workspaceId && (
        <PlaceInWorkspace
          pageId={placing}
          workspaceId={workspaceId}
          onDone={() => {
            setPlacing(undefined);
            open(placing);
          }}
        />
      )}

      {!isLoading && pages.length === 0 && (
        <Text
          $size="sm"
          $variation="secondary"
          $padding={{ horizontal: '2xs' }}
        >
          {workspaceId
            ? t(
                'Pages placed directly in this workspace, outside its spaces, appear here.',
                {
                  description:
                    'Shown when a workspace has no page outside its spaces',
                },
              )
            : t(
                'Pages of your own, outside any workspace and/or space, appear here.',
                {
                  description: 'Shown when the user has no page outside spaces',
                },
              )}
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
