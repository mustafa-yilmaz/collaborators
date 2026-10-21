import Head from 'next/head';
import type { ReactElement, ReactNode } from 'react';
import { css } from 'styled-components';

import { Box, Icon, SCREEN_MAX_WIDTH, Text } from '@/components';
import { HeaderFloatingBar } from '@/features/header/components/HeaderFloatingBar';
import { MainLayout } from '@/layouts';
import { NextPageWithLayout } from '@/types/next';

/** A section of the guide, with an icon. */
const Section = ({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) => (
  <Box
    as="section"
    $gap="2xs"
    $padding={{ top: 'sm' }}
    $css={css`
      border-top: 1px solid var(--c--contextuals--border--surface--primary);
      p {
        margin: 0;
        line-height: 1.55;
      }
      ul {
        margin: 0;
        padding-left: 1.2rem;
        line-height: 1.55;
      }
    `}
  >
    <Box $direction="row" $align="center" $gap="xs">
      <Icon iconName={icon} $size="22px" $theme="brand" />
      <Text as="h2" $size="h6" $weight="700" $margin="none">
        {title}
      </Text>
    </Box>
    {children}
  </Box>
);

/**
 * /guide/: how Collaborators is organised and used. English only, written to
 * grow: a first version, completed over time.
 */
const Page: NextPageWithLayout = () => (
  <>
    <Head>
      <title>How Collaborators works - Collaborators</title>
    </Head>
    <HeaderFloatingBar />
    <Box $width="100%" $css="overflow-y: auto;">
      <Box
        $width="100%"
        $maxWidth={SCREEN_MAX_WIDTH}
        $margin={{ horizontal: 'auto' }}
        $padding={{ horizontal: 'base', vertical: 'xl' }}
        $gap="md"
        data-testid="guide"
      >
        <Box $gap="2xs">
          <Text as="h1" $size="h3" $weight="700" $margin="none">
            How Collaborators works
          </Text>
          <Text $variation="secondary">
            A short guide to how things are organised, and to the main ways of
            working together. It grows over time.
          </Text>
        </Box>

        <Section icon="account_tree" title="The structure">
          <p>
            Collaborators has three levels: <strong>workspaces</strong> hold{' '}
            <strong>spaces</strong>, and spaces hold <strong>pages</strong>.
            Pages can hold sub-pages, as deep as needed.
          </p>
          <p>
            Not everything needs all three levels: a page can sit directly in a
            workspace or in a space, or stay on its own; a space can stay
            outside any workspace too.
          </p>
        </Section>

        <Section icon="workspaces" title="Workspaces">
          <p>
            A workspace gathers people working together: a company, a
            university, a project consortium, a community. Its members can be
            organised in groups (teams and organisations), and its
            administrators manage members, groups, its spaces and who can find
            or join it.
          </p>
          <ul>
            <li>Switch between your workspaces at the top of the sidebar.</li>
            <li>
              People can join with an invitation link, by their email domain or
              organisation, or by asking from &quot;Discover workspaces&quot;.
            </li>
          </ul>
        </Section>

        <Section icon="folder" title="Spaces">
          <p>
            A space holds the pages about one subject: a project, a proposal, a
            team&apos;s knowledge base. You choose who sees it when you create
            it (everyone, the workspace&apos;s members, or only the people you
            invite). A space can also be published to the web as a wiki.
          </p>
        </Section>

        <Section icon="description" title="Pages">
          <p>
            Pages are where you write together, live: text, tables (with types,
            sorting, filters and summaries), images, files, mentions and more.
            Type <strong>/</strong> in a page to insert anything, and{' '}
            <strong>@</strong> to mention someone, a group or another page.
          </p>
          <ul>
            <li>
              A page belongs to one place but can be shown in other spaces too
              (&quot;Show in another space&quot;).
            </li>
            <li>
              Its menu moves it: into another page, into a space, directly into
              a workspace, or out of everything (&quot;Make independent&quot;).
            </li>
          </ul>
        </Section>

        <Section
          icon="assignment_ind"
          title="Mentions, notifications and assignments"
        >
          <p>
            Mentioning someone notifies them. Mentioning someone in a to-do item
            assigns it to them, and ticking it off marks it done; any other
            mention can be made an assignment from its menu, and so can a
            table&apos;s Person cell. Everything for you is listed under
            &quot;Notifications&quot; in the sidebar and on your dashboard.
          </p>
        </Section>

        <Section icon="sell" title="Labels">
          <p>
            Labels describe workspaces, spaces and pages (a topic, a funding
            programme, a field). Click a label to find everything carrying it
            that you can see.
          </p>
        </Section>

        <Section icon="lock" title="Who sees what">
          <p>
            Each workspace, space and page says who can see it, from only the
            people invited to everyone on the internet. A page in a space is
            seen by the space&apos;s people; share a page to let more people in.
            Your profile shows each of its parts to the audience you choose.
          </p>
        </Section>
      </Box>
    </Box>
  </>
);

Page.getLayout = function getLayout(page: ReactElement) {
  return <MainLayout>{page}</MainLayout>;
};

export default Page;
