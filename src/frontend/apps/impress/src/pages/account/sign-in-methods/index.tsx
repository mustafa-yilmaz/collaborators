import Head from 'next/head';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, SCREEN_MAX_WIDTH, Text } from '@/components';
import { AiAssistants } from '@/features/account/AiAssistants';
import { SignInMethods } from '@/features/account/SignInMethods';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

/** /account/sign-in-methods/: the providers one signs in with. */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const heading = t('Sign-in methods', {
    description: 'Title of the page listing the providers one signs in with',
  });
  const title = `${heading} - ${t('Docs', {
    description: 'Product name, shown in page titles and the logo',
  })}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} key="title" />
      </Head>
      <HeaderFloatingBar />
      <Box $width="100%" $css="overflow-y: auto;">
        <Box
          $width="100%"
          $maxWidth={SCREEN_MAX_WIDTH}
          $margin={{ horizontal: 'auto' }}
          $padding={{ horizontal: 'base', vertical: 'xl' }}
          $gap="sm"
        >
          <Text as="h1" $size="h3" $weight="700" $margin="none">
            {heading}
          </Text>
          <Text $variation="secondary">
            {t(
              'The accounts you sign in to Collaborators with. They all lead to this same Collaborators account.',
              { description: 'Introduction of the sign-in methods page' },
            )}
          </Text>
          <SignInMethods />
          <AiAssistants />
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
