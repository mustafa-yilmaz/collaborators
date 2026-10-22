import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';

import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { NextPageWithLayout } from '@/types/next';

import Home from '../../docs';

/**
 * Collaborators: /workspace/<id>/ — the home, with the left panel inside
 * that workspace (its spaces, pages and settings).
 */
const Page: NextPageWithLayout = () => {
  const { query } = useRouter();
  const id = typeof query.id === 'string' ? query.id : '';
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (id && id !== currentWorkspaceId) {
      setCurrentWorkspaceId(id);
    }
  }, [id, currentWorkspaceId, setCurrentWorkspaceId]);

  return <Home />;
};

Page.getLayout = function getLayout(page: ReactElement) {
  return Home.getLayout ? Home.getLayout(page) : page;
};

export default Page;
