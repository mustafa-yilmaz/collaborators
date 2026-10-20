import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { Box, StyledLink, Text } from '@/components/';
import { Title } from '@/components/Title';
import { useConfig } from '@/core/config';
import { useResponsiveStore } from '@/stores';

import IconLink from './assets/external-link.svg';
import { ContentType } from './types';

// A thin line in the brand colour, fading out at both ends
const BlueStripe = styled.div`
  position: absolute;
  height: 1px;
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--c--globals--colors--brand-300) 20%,
    var(--c--globals--colors--brand-500) 50%,
    var(--c--globals--colors--brand-300) 80%,
    transparent 100%
  );
  /* A little below the footer's edge, closer to its content */
  top: 16px;
`;

export const Footer = () => {
  const { data: config } = useConfig();
  const footerJson = config?.theme_customization?.footer;
  const { i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage;
  const [content, setContent] = useState<ContentType>();
  // On a phone everything is centred, one piece under the other
  const { isMobile } = useResponsiveStore();

  useEffect(() => {
    if (!footerJson) {
      return;
    }

    const langData = footerJson[resolvedLanguage as keyof typeof footerJson];
    const innerContent: ContentType = {};

    innerContent.logo = langData?.logo || footerJson?.default?.logo;
    innerContent.legalLinks =
      langData?.legalLinks || footerJson?.default?.legalLinks;
    innerContent.externalLinks =
      langData && 'externalLinks' in langData
        ? langData?.externalLinks
        : footerJson?.default?.externalLinks;
    innerContent.credits =
      langData && 'credits' in langData
        ? langData?.credits
        : footerJson?.default?.credits;
    innerContent.bottomInformation =
      langData && 'bottomInformation' in langData
        ? langData?.bottomInformation
        : footerJson?.default?.bottomInformation;

    setContent(innerContent);
  }, [footerJson, resolvedLanguage]);

  const { logo, legalLinks, externalLinks, credits, bottomInformation } =
    content || {};

  if (!footerJson || (!legalLinks && !externalLinks && !bottomInformation)) {
    return null;
  }

  return (
    <Box
      $position="relative"
      as="footer"
      role="contentinfo"
      className="--docs--footer"
    >
      <BlueStripe />
      <Box
        $padding={{
          top: 'large',
          horizontal: isMobile ? '1.25rem' : 'big',
          bottom: isMobile ? '1.5rem' : 'small',
        }}
      >
        <Box
          $direction={isMobile ? 'column' : 'row'}
          $gap={isMobile ? '1rem' : '1.5rem'}
          $align="center"
          $justify="space-between"
          $css="flex-wrap: wrap;"
        >
          <Box className="--docs--footer-logo" $gap="2xs" $align="center">
            <Box $align="center" $gap="6rem" $direction="row">
              {logo && (
                <Box
                  $align="center"
                  $gap="0.5rem"
                  $direction="row"
                  $position="relative"
                  $height="fit-content"
                >
                  {logo?.src && (
                    <Image
                      priority
                      width={0}
                      height={0}
                      {...(({
                        withTitle: _withTitle,
                        titleZoom: _titleZoom,
                        link: _link,
                        ...rest
                      }) => rest)(logo)}
                    />
                  )}
                  {logo?.withTitle && (
                    <Box $css={`zoom: ${logo.titleZoom ?? 1.4};`}>
                      <Title />
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            {logo?.link && (
              <StyledLink
                href={logo.link.href}
                target="__blank"
                className="--docs--footer-logo-link"
                $css={css`
                  gap: 0.2rem;
                  align-items: center;
                  width: fit-content;
                  &:hover {
                    box-shadow: 0px 1px 0 0
                      var(
                        --c--contextuals--content--semantic--neutral--secondary
                      );
                  }
                `}
              >
                <Text $size="sm" $variation="secondary">
                  {logo.link.label}
                </Text>
                <IconLink width={14} />
              </StyledLink>
            )}
          </Box>
          <Box
            $direction="row"
            $justify={isMobile ? 'center' : undefined}
            $css={`
              column-gap: 1.5rem;
              row-gap: .5rem;
              flex-wrap: wrap;
              ${isMobile ? 'text-align: center;' : ''}
            `}
            className="--docs--footer-external-links"
          >
            {externalLinks &&
              externalLinks.map(({ label, href }) => (
                <StyledLink
                  key={label}
                  href={href}
                  target="__blank"
                  $css={css`
                    gap: 0.2rem;
                    transition: box-shadow 0.3s;
                    &:hover {
                      box-shadow: 0px 2px 0 0
                        var(
                          --c--contextuals--content--semantic--neutral--secondary
                        );
                    }
                  `}
                >
                  <Text $weight="bold">{label}</Text>
                  <IconLink width={18} />
                </StyledLink>
              ))}
            {credits && (
              <Text
                as="p"
                $margin="none"
                $display="inline"
                className="--docs--footer-credits"
              >
                {credits.map((part, index) =>
                  'href' in part ? (
                    <StyledLink
                      key={index}
                      href={part.href}
                      target="__blank"
                      $css={css`
                        display: inline-flex;
                        gap: 0.2rem;
                        font-weight: bold;
                        box-shadow: 0px 1px 0 0
                          var(
                            --c--contextuals--content--semantic--neutral--secondary
                          );
                      `}
                    >
                      <Text>{part.label}</Text>
                      <IconLink width={14} />
                    </StyledLink>
                  ) : (
                    // On a phone the opening words take a row of their own
                    <span
                      key={index}
                      style={
                        isMobile && index === 0
                          ? { display: 'block' }
                          : undefined
                      }
                    >
                      {part.text}
                    </span>
                  ),
                )}
              </Text>
            )}
          </Box>
        </Box>
        {/* Legal links on the left, the licence on the right, in one row */}
        <Box
          $direction={isMobile ? 'column' : 'row'}
          $align="center"
          $justify="space-between"
          $margin={{ top: isMobile ? '1.5rem' : 'big' }}
          $padding={{ top: isMobile ? '1rem' : 'tiny' }}
          $css={`
            flex-wrap: wrap;
            border-top: 1px solid var(--c--globals--colors--gray-200);
            column-gap: 2rem;
            row-gap: .5rem;
          `}
          className="--docs--footer-bottom-row"
        >
          <Box
            $direction="row"
            $justify={isMobile ? 'center' : undefined}
            $css={`
            flex-wrap: wrap;
            column-gap: ${isMobile ? '1.25rem' : '1rem'};
            row-gap: .5rem;
          `}
            className="--docs--footer-internal-links"
          >
            {legalLinks &&
              legalLinks.map(({ label, href }) => (
                <StyledLink
                  key={label}
                  href={href}
                  // The dividers would dangle where a phone wraps the row
                  $css={
                    isMobile
                      ? undefined
                      : css`
                          padding-right: 1rem;
                          &:not(:last-child) {
                            box-shadow: inset -1px 0px 0px 0px
                              var(--c--globals--colors--gray-200);
                          }
                        `
                  }
                >
                  <Text
                    $size="s"
                    $variation="secondary"
                    $transition="box-shadow 0.3s"
                    $css={css`
                      &:hover {
                        box-shadow: 0px 2px 0 0
                          var(
                            --c--contextuals--content--semantic--neutral--secondary
                          );
                      }
                    `}
                  >
                    {label}
                  </Text>
                </StyledLink>
              ))}
          </Box>
          {bottomInformation && (
            <Text
              as="p"
              $size="s"
              $margin="none"
              $variation="secondary"
              $display="inline"
              $textAlign={isMobile ? 'center' : undefined}
              className="--docs--footer-licence"
            >
              {bottomInformation.label}{' '}
              {bottomInformation.link && (
                <StyledLink
                  href={bottomInformation.link.href}
                  target="__blank"
                  $css={css`
                    display: inline-flex;
                    box-shadow: 0px 1px 0 0
                      var(
                        --c--contextuals--content--semantic--neutral--secondary
                      );
                    gap: 0.2rem;
                  `}
                >
                  <Text>{bottomInformation.link.label}</Text>
                  <IconLink width={14} />
                </StyledLink>
              )}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};
