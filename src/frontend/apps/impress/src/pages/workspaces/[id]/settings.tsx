import Head from 'next/head';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components';
import { WorkspaceSettings } from '@/features/workspaces/components/WorkspaceSettings';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query } = useRouter();
  const workspaceId = typeof query.id === 'string' ? query.id : '';
  const title = `${t('Workspace settings', {
    description: 'Menu entry opening the settings of a workspace',
  })} - ${t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  })}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} key="title" />
      </Head>
      <Box $width="100%" $css="overflow-y: auto;">
        {workspaceId && <WorkspaceSettings workspaceId={workspaceId} />}
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
