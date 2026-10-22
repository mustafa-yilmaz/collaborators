import {
  Button,
  DropdownMenu,
  DropdownMenuItem,
} from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Icon, Text } from '@/components';
import { useLeftPanelStore } from '@/features/left-panel/stores/useLeftPanelStore';
import { usePageMoves, useWorkspaces } from '@/features/workspaces/api';
import { CreateSpaceModal } from '@/features/workspaces/components/CreateSpaceModal';
import { CreateWorkspaceModal } from '@/features/workspaces/components/CreateWorkspaceModal';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import ArrowDownIcon from '@/icons/arrow-drop-down.svg';
import SubDocIcon from '@/icons/doc-new-subdoc.svg';
import PlusIcon from '@/icons/doc-plus.svg';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

import { useCreateChildDoc } from '../api/useCreateChildDoc';
import { useCreateDoc } from '../api/useCreateDoc';
import { useDocStore } from '../stores/useDocStore';

interface NewDocButtonProps {
  onClose?: () => void;
}

/** Places a page just created directly in the workspace, then opens it. */
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
 * "New": a workspace, a space or a page (in the workspace shown in the left
 * panel, if any), and, on a page, a sub-page of it.
 */
export const NewDocButton = ({ onClose }: NewDocButtonProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const { currentDoc } = useDocStore();
  const { currentWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspaces();
  const workspace = workspaces.find((item) => item.id === currentWorkspaceId);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [creating, setCreating] = useState<'workspace' | 'space'>();
  const [placing, setPlacing] = useState<string>();

  const open = (docId: string) => {
    void router.push(`/page/${docId}/`);
    if (isMobile) {
      closePanel();
    }
    onClose?.();
  };
  const { mutate: createPage } = useCreateDoc({
    onSuccess: (doc) => (workspace ? setPlacing(doc.id) : open(doc.id)),
  });
  const { mutate: createChildDoc } = useCreateChildDoc({
    onSuccess: (doc) => open(doc.id),
  });

  const options: DropdownMenuItem[] = [
    {
      label: t('Create a new workspace', {
        description: 'New menu: create a workspace',
      }),
      icon: <Icon iconName="workspaces" $size="22px" />,
      callback: () => setCreating('workspace'),
    },
    {
      label: t('Create a new space', {
        description: 'New menu: create a space',
      }),
      icon: <Icon iconName="create_new_folder" $size="22px" />,
      callback: () => setCreating('space'),
    },
    {
      label: t('Create a new page', {
        description: 'New menu: create a page',
      }),
      icon: <PlusIcon aria-hidden="true" width="22" height="22" />,
      callback: () => createPage({}),
    },
    {
      label: t('New sub-page', {
        description: 'Action to create a doc nested under the current doc',
      }),
      icon: <SubDocIcon aria-hidden="true" width="22" height="22" />,
      callback: () => currentDoc && createChildDoc({ parentId: currentDoc.id }),
      isHidden: !currentDoc,
    },
  ];

  return (
    <>
      <DropdownMenu
        options={options}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}
      >
        <Button
          data-testid="new-doc-button"
          color="brand"
          aria-expanded={isMenuOpen}
          aria-label={t('Open new page options', {
            description:
              'Accessible name of the button opening the new document menu',
          })}
          icon={<PlusIcon aria-hidden="true" width={24} height={24} />}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <Text $withThemeInherited $size="md" $weight="500">
            {t('New', { description: 'Button to create a new document' })}
          </Text>
          <ArrowDownIcon aria-hidden="true" width="20" height="20" />
        </Button>
      </DropdownMenu>
      {creating === 'workspace' && (
        <CreateWorkspaceModal onClose={() => setCreating(undefined)} />
      )}
      {creating === 'space' && (
        <CreateSpaceModal
          workspace={workspace}
          onClose={() => setCreating(undefined)}
        />
      )}
      {placing && workspace && (
        <PlaceInWorkspace
          pageId={placing}
          workspaceId={workspace.id}
          onDone={() => {
            setPlacing(undefined);
            open(placing);
          }}
        />
      )}
    </>
  );
};
