import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { useLeftPanelStore } from '@/features/left-panel/stores';
import { useResponsiveStore } from '@/stores';

import { useSpaces, useWorkspaces } from '../api';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { LinkReachIcon } from '../utils';

import { CreateSpaceModal } from './CreateSpaceModal';

/** The spaces of the current workspace, or my independent spaces. */
export const SpaceList = () => {
  const { t } = useTranslation();
  const { colorsTokens } = useCunninghamTheme();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const [isCreating, setIsCreating] = useState(false);
  const { currentWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspaces();
  const workspace = workspaces.find((ws) => ws.id === currentWorkspaceId);
  const { data: spaces = [], isLoading } = useSpaces(
    workspace ? { workspaceId: workspace.id } : { independent: true },
  );

  return (
    <Box
      $padding={{ horizontal: 'sm' }}
      $gap="3xs"
      className="--collaborators--space-list"
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
          {t('Spaces', { description: 'Heading of the list of spaces' })}
        </Text>
        <BoxButton
          onClick={() => setIsCreating(true)}
          aria-label={t('New space', {
            description: 'Button creating a space',
          })}
          title={t('New space', { description: 'Button creating a space' })}
          $padding="4xs"
          $css="border-radius: 4px;"
        >
          <Icon iconName="add" $size="20px" $variation="secondary" />
        </BoxButton>
      </Box>

      {!isLoading && spaces.length === 0 && (
        <Text
          $size="sm"
          $variation="secondary"
          $padding={{ horizontal: '2xs' }}
        >
          {workspace
            ? t('No space here yet. Create the first one with +.', {
                description: 'Shown when a workspace has no space',
              })
            : t('Spaces you create outside workspaces appear here.', {
                description: 'Shown when the user has no independent space',
              })}
        </Text>
      )}

      {spaces.map((space) => {
        const sharedFrom =
          workspace && space.home_workspace?.id !== workspace.id
            ? space.home_workspace?.name
            : undefined;
        return (
          <StyledLink
            key={space.id}
            href={`/docs/${space.id}`}
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
            <Icon iconName="folder" $size="20px" $variation="tertiary" />
            <Box $flex={1} $css="min-width: 0;">
              <Text $size="sm" $weight="500" $ellipsis>
                {space.title ||
                  t('Untitled space', {
                    description: 'Name of a space without title',
                  })}
              </Text>
              {sharedFrom && (
                <Text $size="xs" $variation="secondary" $ellipsis>
                  {t('Shared from {{name}}', {
                    description:
                      'Shown under a space shared by another workspace',
                    name: sharedFrom,
                  })}
                </Text>
              )}
            </Box>
            <LinkReachIcon reach={space.link_reach} />
          </StyledLink>
        );
      })}

      {isCreating && (
        <CreateSpaceModal
          workspace={workspace}
          onClose={() => setIsCreating(false)}
        />
      )}
    </Box>
  );
};
