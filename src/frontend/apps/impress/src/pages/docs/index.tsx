import Head from 'next/head';
import { useSearchParams } from 'next/navigation';
import type { PropsWithChildren, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { DocDefaultFilter, useTrans } from '@/docs/doc-management';
import { CollaborationsScreen } from '@/features/collaborations/CollaborationsScreen';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { useSidebarSide } from '@/features/left-panel';
import { MainLayout } from '@/layouts';
import { useResponsiveStore } from '@/stores/useResponsiveStore';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { transFilter } = useTrans();
  const { isDesktop } = useResponsiveStore();
  const searchParams = useSearchParams();
  const targetParam = searchParams.get('target') as DocDefaultFilter | null;
  const target = targetParam ?? DocDefaultFilter.ALL_DOCS;
  // Without a list chosen in the left panel, the home is the dashboard
  const isDashboard = !targetParam;
  const pageTitle = isDashboard
    ? t('Home', {
        description: 'Button/link label to go back to the home page',
      })
    : transFilter(target);

  return (
    <>
      <Head>
        <title>{`${pageTitle} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}</title>
        <meta
          property="og:title"
          content={`${pageTitle} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}
          key="title"
        />
      </Head>
      <HeaderFloatingBar
        $css={
          isDesktop
            ? css`
                &::before {
                  background: transparent;
                }
              `
            : undefined
        }
      />
      {isDashboard ? <Dashboard /> : <CollaborationsScreen target={target} />}
    </>
  );
};

const DocsPageLayout = ({ children }: PropsWithChildren) => {
  const { isDesktop } = useResponsiveStore();
  // Collaborators: the tint goes to the corner away from the left panel,
  // wherever it stands
  const { isRight } = useSidebarSide();

  return (
    <MainLayout
      propsContent={{
        $background: !isDesktop
          ? 'var(--c--contextuals--background--surface--primary)'
          : `linear-gradient(${isRight ? '-53deg' : '53deg'}, var(--c--contextuals--background--surface--primary) 39.96%, var(--c--contextuals--background--semantic--brand--tertiary) 125.64%)`,
      }}
    >
      {children}
    </MainLayout>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <DocsPageLayout>{page}</DocsPageLayout>;
};

export default Page;
