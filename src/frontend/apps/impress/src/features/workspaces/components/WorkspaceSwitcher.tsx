import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';

import { useWorkspaces } from '../api';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

/**
 * The top of the left panel in a workspace: back to "My collaborations",
 * the workspace's name and its settings. A workspace is opened from the lists
 * of "My collaborations"; outside workspaces nothing is shown here.
 */
export const WorkspaceSwitcher = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    data: workspaces = [],
    isFetched,
    isFetching,
    refetch,
  } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();
  const current = workspaces.find((ws) => ws.id === currentWorkspaceId);
  // Collaborators: the workspace asked again for, before forgetting it
  const recheckedId = useRef<string | null>(null);

  // Forget a workspace the user left or that was deleted. Collaborators: not
  // one only missing from a list loaded before it was made (opened from
  // "Recent", say): the list is asked for again first
  useEffect(() => {
    if (
      !isFetched ||
      isFetching ||
      !currentWorkspaceId ||
      current ||
      recheckedId.current === currentWorkspaceId
    ) {
      return;
    }
    const missing = currentWorkspaceId;
    recheckedId.current = missing;
    void refetch().then(({ data }) => {
      if (
        !data?.some((ws) => ws.id === missing) &&
        useWorkspaceStore.getState().currentWorkspaceId === missing
      ) {
        setCurrentWorkspaceId(null);
      }
    });
  }, [
    isFetched,
    isFetching,
    currentWorkspaceId,
    current,
    refetch,
    setCurrentWorkspaceId,
  ]);

  if (!current) {
    return null;
  }

  const settingsLabel = t('Workspace settings', {
    description: 'Menu entry opening the settings of a workspace',
  });

  return (
    <Box
      $padding={{ horizontal: 'sm' }}
      $gap="3xs"
      className="--collaborators--switcher"
    >
      <BoxButton
        onClick={() => {
          setCurrentWorkspaceId(null);
          void router.push('/');
        }}
        $direction="row"
        $align="center"
        $gap="3xs"
        $padding={{ horizontal: '2xs', vertical: '4xs' }}
        $css={css`
          width: fit-content;
          border-radius: var(--c--globals--spacings--3xs);
          &:hover {
            background-color: var(
              --c--contextuals--background--semantic--contextual--primary
            );
          }
        `}
      >
        <Icon iconName="arrow_back" $size="18px" $variation="secondary" />
        <Text $size="sm" $variation="secondary">
          {t('My collaborations', {
            description: 'Left panel entry for content outside workspaces',
          })}
        </Text>
      </BoxButton>
      <Box
        $direction="row"
        $align="center"
        $gap="2xs"
        $padding={{ horizontal: '2xs' }}
      >
        <Icon iconName="workspaces" $size="20px" $variation="secondary" />
        <Text $size="md" $weight="700" $ellipsis $css="flex: 1;">
          {current.name}
        </Text>
        <BoxButton
          onClick={() => void router.push(`/workspaces/${current.id}/settings`)}
          aria-label={settingsLabel}
          title={settingsLabel}
          $padding="4xs"
          $css="border-radius: 4px;"
        >
          <Icon iconName="settings" $size="18px" $variation="secondary" />
        </BoxButton>
      </Box>
    </Box>
  );
};
