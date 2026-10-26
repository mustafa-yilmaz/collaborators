import Head from 'next/head';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, SCREEN_MAX_WIDTH, Text } from '@/components';
import { ConnectedAssistants } from '@/features/account/ConnectedAssistants';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

/** /account/assistants/: one's own AI assistants, connected to add input. */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const heading = t('Connected assistants', {
    description: 'Title of the page about one’s own AI assistants',
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
              'Add your input to Collaborators pages from your own AI assistant: Claude, ChatGPT or Gemini.',
              { description: 'Introduction of the connected assistants page' },
            )}
          </Text>
          <ConnectedAssistants />
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
