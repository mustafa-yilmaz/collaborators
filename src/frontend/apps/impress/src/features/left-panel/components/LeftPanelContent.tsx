import { useTreeContext } from '@gouvfr-lasuite/ui-components';
import { useRouter } from 'next/router';
import { css } from 'styled-components';

import { Box, SeparatedSection } from '@/components';
import { Doc } from '@/features/docs/doc-management';
import { useDocStore } from '@/features/docs/doc-management/stores/useDocStore';
import { DocTree } from '@/features/docs/doc-tree/components/DocTree';
import { TreeSkeleton } from '@/features/skeletons/components/TreeSkeleton';
import {
  PageList,
  SpaceList,
  WorkspaceSwitcher,
  useWorkspaceStore,
} from '@/features/workspaces';

import { LeftPanelTargetFilters } from './LefPanelTargetFilters';

export const LeftPanelContent = () => {
  const router = useRouter();
  const isHome = router.pathname === '/';
  const isDoc = router.pathname === '/docs/[id]';
  const isWorkspacePage = router.pathname.startsWith('/workspaces/');
  const { currentWorkspaceId } = useWorkspaceStore();

  if (isHome || isWorkspacePage) {
    return (
      <>
        <Box
          $width="100%"
          $gap="sm"
          $padding={{ top: 'xs' }}
          $css={css`
            flex: 1 1 auto;
            overflow-y: auto;
          `}
          className="--docs--home-left-panel-content"
        >
          <WorkspaceSwitcher />
          <SpaceList />
          {/* Independent pages live outside workspaces */}
          {!currentWorkspaceId && (
            <>
              <PageList />
              <SeparatedSection showSeparator={true}>
                <LeftPanelTargetFilters />
              </SeparatedSection>
            </>
          )}
        </Box>
      </>
    );
  }

  if (isDoc) {
    return <LeftPanelDocContent />;
  }

  return null;
};

const LeftPanelDocContent = () => {
  const tree = useTreeContext<Doc>();
  const { currentDoc } = useDocStore();

  return (
    <Box
      $flex={1}
      $width="100%"
      $css="width: 100%; overflow-y: auto; overflow-x: hidden;"
      className="--docs--left-panel-doc-content"
    >
      {tree && currentDoc ? (
        <DocTree currentDoc={currentDoc} />
      ) : (
        <TreeSkeleton />
      )}
    </Box>
  );
};
