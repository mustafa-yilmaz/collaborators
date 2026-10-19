import Head from 'next/head';
import { useTranslation } from 'react-i18next';

import { SignIn } from '@/features/signin/SignIn';
import { NextPageWithLayout } from '@/types/next';

const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const title = t('Sign in', { description: 'Button to log in' });

  return (
    <>
      <Head>
        <title>{`${title} - ${t('Docs', { description: 'Product name, shown in page titles and the logo' })}`}</title>
        <meta property="og:title" content={title} key="title" />
      </Head>
      <SignIn />
    </>
  );
};

export default Page;
