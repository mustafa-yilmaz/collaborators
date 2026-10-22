import Head from 'next/head';
import { useRouter } from 'next/router';
import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import {
  Box,
  Icon,
  Loading,
  SCREEN_MAX_WIDTH,
  StyledLink,
  Text,
} from '@/components';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { useLabelDetail } from '@/features/labels/api';
import { useWorkspaceStore } from '@/features/workspaces/stores/useWorkspaceStore';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

const rowCss = css`
  display: flex;
  align-items: center;
  gap: var(--c--globals--spacings--xs);
  padding: var(--c--globals--spacings--2xs) var(--c--globals--spacings--xs);
  border-radius: var(--c--globals--spacings--3xs);
  color: inherit;
  text-decoration: none;
  &:hover {
    background-color: var(
      --c--contextuals--background--semantic--contextual--primary
    );
  }
`;

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box $gap="3xs">
    <Text as="h2" $size="sm" $weight="700" $margin="none">
      {title}
    </Text>
    {children}
  </Box>
);

/** /labels/?name=<label>: the workspaces, spaces and pages carrying it. */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query, push } = useRouter();
  const name = typeof query.name === 'string' ? query.name : '';
  const { data, isLoading, isError } = useLabelDetail(name);
  const { setCurrentWorkspaceId } = useWorkspaceStore();
  const untitled = t('Untitled page', {
    description: 'Name of a page without title',
  });

  return (
    <>
      <Head>
        <title>{`#${name} - Collaborators`}</title>
      </Head>
      <HeaderFloatingBar />
      <Box $width="100%" $css="overflow-y: auto;">
        <Box
          $width="100%"
          $maxWidth={SCREEN_MAX_WIDTH}
          $margin={{ horizontal: 'auto' }}
          $padding={{ horizontal: 'base', vertical: 'xl' }}
          $gap="md"
        >
          <Box $direction="row" $align="center" $gap="xs">
            <Icon iconName="sell" $size="28px" $theme="brand" />
            <Text as="h1" $size="h3" $weight="700" $margin="none">
              #{data?.name ?? name}
            </Text>
          </Box>
          {isLoading && <Loading />}
          {isError && (
            <Text $variation="secondary">
              {t('Nothing you can see carries this label.', {
                description: 'Label page without results',
              })}
            </Text>
          )}
          {data && (
            <>
              {data.workspaces.length > 0 && (
                <Group
                  title={t('Workspaces', {
                    description: 'Heading of a list of workspaces',
                  })}
                >
                  {data.workspaces.map((workspace) => (
                    <StyledLink
                      key={workspace.id}
                      href="/"
                      $css={rowCss}
                      onClick={(event) => {
                        event.preventDefault();
                        setCurrentWorkspaceId(workspace.id);
                        void push('/');
                      }}
                    >
                      <Icon
                        iconName="workspaces"
                        $size="20px"
                        $variation="secondary"
                      />
                      <Text $weight="500">{workspace.name}</Text>
                    </StyledLink>
                  ))}
                </Group>
              )}
              {data.spaces.length > 0 && (
                <Group
                  title={t('Spaces', {
                    description: 'Heading of the list of spaces',
                  })}
                >
                  {data.spaces.map((space) => (
                    <StyledLink
                      key={space.id}
                      href={`/page/${space.id}/`}
                      $css={rowCss}
                    >
                      <Icon
                        iconName="folder"
                        $size="20px"
                        $variation="secondary"
                      />
                      <Text $weight="500">{space.title || untitled}</Text>
                    </StyledLink>
                  ))}
                </Group>
              )}
              {data.pages.length > 0 && (
                <Group
                  title={t('Pages', {
                    description: 'Heading of a list of pages',
                  })}
                >
                  {data.pages.map((page) => (
                    <StyledLink
                      key={page.id}
                      href={`/page/${page.id}/`}
                      $css={rowCss}
                    >
                      <Icon
                        iconName="description"
                        $size="20px"
                        $variation="secondary"
                      />
                      <Text $weight="500">{page.title || untitled}</Text>
                    </StyledLink>
                  ))}
                </Group>
              )}
              {!data.workspaces.length &&
                !data.spaces.length &&
                !data.pages.length && (
                  <Text $variation="secondary">
                    {t('Nothing you can see carries this label.', {
                      description: 'Label page without results',
                    })}
                  </Text>
                )}
            </>
          )}
        </Box>
      </Box>
    </>
  );
};

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
