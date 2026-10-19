import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';

import { useWorkspaces } from '../api';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

import { CreateWorkspaceModal } from './CreateWorkspaceModal';

/** Choose what the left panel shows: a workspace, or my own spaces and pages. */
export const WorkspaceSwitcher = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { data: workspaces = [], isFetched, isFetching } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();
  const current = workspaces.find((ws) => ws.id === currentWorkspaceId);

  // Forget a workspace the user left or that was deleted
  useEffect(() => {
    if (isFetched && !isFetching && currentWorkspaceId && !current) {
      setCurrentWorkspaceId(null);
    }
  }, [
    isFetched,
    isFetching,
    currentWorkspaceId,
    current,
    setCurrentWorkspaceId,
  ]);

  const personalLabel = t('My spaces & pages', {
    description: 'Left panel entry for content outside workspaces',
  });

  const options = useMemo<DropdownMenuItem[]>(
    () => [
      {
        label: personalLabel,
        icon: <Icon iconName="person" $size="20px" />,
        isChecked: !current,
        callback: () => setCurrentWorkspaceId(null),
      },
      ...workspaces.map((workspace) => ({
        label: workspace.name,
        icon: <Icon iconName="workspaces" $size="20px" />,
        isChecked: workspace.id === current?.id,
        callback: () => setCurrentWorkspaceId(workspace.id),
      })),
      { type: 'separator' as const },
      {
        label: t('Workspace settings', {
          description: 'Menu entry opening the settings of a workspace',
        }),
        icon: <Icon iconName="settings" $size="20px" />,
        isHidden: !current,
        callback: () => {
          if (current) {
            void router.push(`/workspaces/${current.id}/settings`);
          }
        },
      },
      {
        label: t('Discover workspaces', {
          description: 'Menu entry opening the directory of workspaces',
        }),
        icon: <Icon iconName="travel_explore" $size="20px" />,
        callback: () => void router.push('/workspaces/discover/'),
      },
      {
        label: t('Create a workspace', {
          description: 'Menu entry creating a workspace',
        }),
        icon: <Icon iconName="add" $size="20px" />,
        callback: () => setIsCreating(true),
      },
    ],
    [workspaces, current, personalLabel, router, setCurrentWorkspaceId, t],
  );

  return (
    <Box $padding={{ horizontal: 'sm' }} className="--collaborators--switcher">
      <DropdownMenu options={options} isOpen={isOpen} onOpenChange={setIsOpen}>
        <BoxButton
          onClick={() => setIsOpen((open) => !open)}
          aria-label={t('Switch workspace, current: {{name}}', {
            description: 'Accessible name of the workspace switcher',
            name: current?.name ?? personalLabel,
          })}
          $direction="row"
          $align="center"
          $gap="2xs"
          $width="100%"
          $padding={{ horizontal: '2xs', vertical: '2xs' }}
          $css={css`
            border-radius: var(--c--globals--spacings--3xs);
            border: 1px solid var(--c--contextuals--border--surface--primary);
            &:hover {
              background-color: var(
                --c--contextuals--background--semantic--contextual--primary
              );
            }
          `}
        >
          <Icon
            iconName={current ? 'workspaces' : 'person'}
            $size="20px"
            $variation="secondary"
          />
          <Text $size="sm" $weight="600" $ellipsis $css="flex: 1;">
            {current?.name ?? personalLabel}
          </Text>
          <Icon iconName="unfold_more" $size="18px" $variation="secondary" />
        </BoxButton>
      </DropdownMenu>
      {isCreating && (
        <CreateWorkspaceModal onClose={() => setIsCreating(false)} />
      )}
    </Box>
  );
};
