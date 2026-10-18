import {
  Button,
  Modal,
  ModalSize,
  Select,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';
import { Doc } from '@/features/docs/doc-management';

import { useSpaceMutations, useWorkspaces } from '../api';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

interface MoveSpaceModalProps {
  space: Doc;
  onClose: () => void;
}

/** Give an independent space a home workspace. */
export const MoveSpaceModal = ({ space, onClose }: MoveSpaceModalProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const { data: workspaces = [] } = useWorkspaces();
  const { moveToWorkspace } = useSpaceMutations(space.id);
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  const [workspaceId, setWorkspaceId] = useState('');
  const title = t('Move to a workspace', {
    description: 'Menu action moving an independent space into a workspace',
  });

  return (
    <Modal
      isOpen
      closeOnClickOutside
      onClose={onClose}
      size={ModalSize.MEDIUM}
      aria-label={title}
      title={
        <Text as="h1" $margin="0" $size="h6" $align="flex-start">
          {title}
        </Text>
      }
      rightActions={
        <>
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t('Cancel', {
              description: 'Button to dismiss a dialog without confirming',
            })}
          </Button>
          <Button
            fullWidth
            disabled={!workspaceId || moveToWorkspace.isPending}
            onClick={() =>
              moveToWorkspace.mutate(
                { workspaceId },
                {
                  onSuccess: () => {
                    setCurrentWorkspaceId(workspaceId);
                    onClose();
                  },
                  onError: () =>
                    toast(
                      t('The space could not be moved.', {
                        description: 'Toast shown when moving a space failed',
                      }),
                      VariantType.ERROR,
                    ),
                },
              )
            }
          >
            {t('Move', { description: 'Button moving something' })}
          </Button>
        </>
      }
    >
      <Box $gap="sm" $padding={{ top: 'xs' }}>
        <Text $variation="secondary" as="p" $margin="none">
          {t(
            'The workspace becomes the home of this space: its administrators can manage it, and you can open it to the workspace members from the share dialog.',
            { description: 'Explanation in the dialog moving a space' },
          )}
        </Text>
        {workspaces.length ? (
          <Select
            fullWidth
            label={t('Workspace', {
              description: 'Label choosing a workspace',
            })}
            clearable={false}
            options={workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.name,
            }))}
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value as string)}
          />
        ) : (
          <Text $size="sm">
            {t('You are not a member of any workspace yet.', {
              description: 'Shown when the user has no workspace',
            })}
          </Text>
        )}
      </Box>
    </Modal>
  );
};
