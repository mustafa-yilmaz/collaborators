import Head from 'next/head';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, SCREEN_MAX_WIDTH, Text } from '@/components';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { ProfileSettings } from '@/features/profile/ProfileSettings';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

/** /account/profile/: one's profile, and who sees each piece of it. */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const heading = t('My profile', {
    description: 'Title of the profile settings page',
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
          <ProfileSettings />
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
