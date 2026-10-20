import Head from 'next/head';
import Link from 'next/link';
import { PropsWithChildren } from 'react';
import styled from 'styled-components';

import { Box, SCREEN_MAX_WIDTH, StyledLink, Text } from '@/components';
import { Title } from '@/components/Title';
import { Footer } from '@/features/footer';
import { useResponsiveStore } from '@/stores';

/** The address people write to about their data, the site or its access. */
export const CONTACT_EMAIL = 'admin@collaborators.community';

// The legal pages, linked from the footer (theme customization)
export const LEGAL_PAGES = {
  legalNotice: '/legal-notice/',
  privacy: '/privacy/',
  accessibility: '/accessibility/',
};

// Long reading text: a comfortable line length, links that look like links
const Prose = styled.article`
  max-width: 760px;
  line-height: 1.6;
  color: var(--c--contextuals--content--semantic--neutral--primary);

  h2 {
    font-size: 1.3rem;
    margin: 2rem 0 0.5rem;
  }
  h3 {
    font-size: 1.05rem;
    margin: 1.25rem 0 0.25rem;
  }
  p {
    margin: 0.5rem 0;
  }
  ul {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }
  li {
    margin: 0.25rem 0;
  }
  a {
    color: var(--c--contextuals--content--semantic--brand--primary);
    text-decoration: underline;
  }
`;

/**
 * What only the owner of the site can confirm (the legal entity, an address,
 * a provider's name…): shown as is, highlighted, rather than made up.
 */
export const Placeholder = ({ children }: PropsWithChildren) => (
  <mark
    data-testid="legal-placeholder"
    style={{
      background: 'var(--c--globals--colors--orange-100, #fff3cd)',
      padding: '0 0.25rem',
      borderRadius: '3px',
    }}
  >
    [To be completed: {children}]
  </mark>
);

/** A link to another page of the site, inside the text. */
export const PageLink = ({
  href,
  children,
}: PropsWithChildren<{ href: string }>) => <Link href={href}>{children}</Link>;

export const MailLink = () => (
  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
);

interface LegalPageProps {
  title: string;
  /** When the text last changed, written out (e.g. "20 October 2026") */
  updated: string;
}

/**
 * A standalone page of reading text (legal notice, privacy policy,
 * accessibility statement), open to everyone, signed in or not.
 */
export const LegalPage = ({
  title,
  updated,
  children,
}: PropsWithChildren<LegalPageProps>) => {
  const { isSmallMobile } = useResponsiveStore();

  return (
    <>
      <Head>
        <title>{`${title} - Collaborators`}</title>
        <meta property="og:title" content={title} key="title" />
      </Head>
      <Box as="main" $height="100vh" $css="overflow-y: auto;">
        <Box
          $flex={1}
          $width="100%"
          $maxWidth={SCREEN_MAX_WIDTH}
          $margin={{ horizontal: 'auto' }}
          $padding={{ horizontal: isSmallMobile ? 'sm' : 'md', vertical: 'lg' }}
          $gap="md"
        >
          {/* Not a heading: the page's own title is the first one */}
          <StyledLink href="/">
            <Title as="span" $size="1.4rem" />
          </StyledLink>
          <Prose>
            <Text as="h1" $size="h3" $weight="700" $margin="none">
              {title}
            </Text>
            <Text $size="sm" $variation="secondary">
              Last updated: {updated}
            </Text>
            {children}
          </Prose>
        </Box>
        <Footer />
      </Box>
    </>
  );
};
