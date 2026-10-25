import Head from 'next/head';
import { useRouter } from 'next/router';
import { ReactElement, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { useWorkspaces } from '@/features/workspaces/api';
import { WorkspaceScreen } from '@/features/workspaces/components/WorkspaceScreen';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { NextPageWithLayout } from '@/types/next';

import Home from '../../docs';

/**
 * Collaborators: /workspace/<id>/ — a workspace's own screen (its spaces as
 * folders, its pages as documents), with the left panel inside it.
 */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const id = typeof query.id === 'string' ? query.id : '';
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();
  const { data: workspaces } = useWorkspaces();
  const name = workspaces?.find((ws) => ws.id === id)?.name;

  useEffect(() => {
    if (id && id !== currentWorkspaceId) {
      setCurrentWorkspaceId(id);
    }
  }, [id, currentWorkspaceId, setCurrentWorkspaceId]);

  const title = `${
    name ?? t('Workspace', { description: 'Title of a workspace screen' })
  } - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} key="title" />
      </Head>
      <HeaderFloatingBar />
      {id && <WorkspaceScreen workspaceId={id} />}
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return Home.getLayout ? Home.getLayout(page) : page;
};

export default Page;
