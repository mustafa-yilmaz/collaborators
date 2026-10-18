import {
  Button,
  Input,
  Modal,
  ModalSize,
  VariantType,
  useToastProvider,
} from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Text } from '@/components';

import { useCreateWorkspace } from '../api';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';

interface CreateWorkspaceModalProps {
  onClose: () => void;
}

export const CreateWorkspaceModal = ({
  onClose,
}: CreateWorkspaceModalProps) => {
  const { t } = useTranslation();
  const { toast } = useToastProvider();
  const [name, setName] = useState('');
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  const { mutate: createWorkspace, isPending } = useCreateWorkspace();

  const onCreate = () => {
    createWorkspace(
      { name: name.trim() },
      {
        onSuccess: (workspace) => {
          setCurrentWorkspaceId(workspace.id);
          onClose();
        },
        onError: () => {
          toast(
            t('The workspace could not be created.', {
              description: 'Toast shown when creating a workspace failed',
            }),
            VariantType.ERROR,
          );
        },
      },
    );
  };

  const title = t('Create a workspace', {
    description: 'Title of the dialog creating a workspace',
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
            disabled={!name.trim() || isPending}
            onClick={onCreate}
          >
            {t('Create', { description: 'Button creating something' })}
          </Button>
        </>
      }
    >
      <Box $gap="sm" $padding={{ top: 'xs' }}>
        <Text $variation="secondary" as="p" $margin="none">
          {t(
            'A workspace gathers the spaces, members and groups of an organisation, a company or a community. You will be its owner.',
            { description: 'Explanation in the dialog creating a workspace' },
          )}
        </Text>
        <Input
          fullWidth
          label={t('Workspace name', {
            description: 'Label of the workspace name field',
          })}
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) {
              onCreate();
            }
          }}
        />
      </Box>
    </Modal>
  );
};
