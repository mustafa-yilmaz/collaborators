import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useTranslation } from 'react-i18next';

import { SkipToContent } from '@/components';
import { AppProvider } from '@/core/';
import { BRAND_NAME } from '@/features/people/BrandName';
import { useOffline, useSWRegister } from '@/features/service-worker/';
import '@/i18n/initI18n';
import { NextPageWithLayout } from '@/types/next';

import './globals.css';

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  useSWRegister();
  useOffline();

  const getLayout = Component.getLayout ?? ((page) => page);
  const { t } = useTranslation();
  const siteDescription = t(
    'Collaborative proposal idea development for projects: workspaces, spaces and pages to write, plan and share together.',
    { description: 'Description of the platform, shown in link previews' },
  );

  return (
    <>
      <Head>
        {/* Collaborators: what links shared elsewhere show (WhatsApp, Slack,
            search engines…), read from the page before any script runs */}
        <title>{BRAND_NAME}</title>
        <meta property="og:title" content={BRAND_NAME} key="title" />
        <meta property="og:site_name" content={BRAND_NAME} />
        <meta property="og:type" content="website" />
        <meta name="description" content={siteDescription} />
        <meta property="og:description" content={siteDescription} />
        <meta name="twitter:card" content="summary" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AppProvider>
        <SkipToContent />
        {getLayout(<Component {...pageProps} />)}
      </AppProvider>
    </>
  );
}
