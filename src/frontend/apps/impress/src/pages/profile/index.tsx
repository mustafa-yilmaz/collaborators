import { Button } from '@gouvfr-lasuite/ui-components';
import Head from 'next/head';
import { useRouter } from 'next/router';
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
import { Title } from '@/components/Title';
import { UserAvatar } from '@/features/auth';
import { LabelChip } from '@/features/labels/LabelEditor';
import { InterestsTitle } from '@/features/profile/InterestsTitle';
import { useProfile } from '@/features/profile/api';
import { NextPageWithLayout } from '@/types/next';

const Detail = ({ icon, children }: { icon: string; children: string }) => (
  <Box $direction="row" $align="center" $gap="2xs">
    <Icon iconName={icon} $size="18px" $variation="secondary" />
    <Text $size="sm">{children}</Text>
  </Box>
);

/**
 * /profile/?id=<user>: what a collaborator tells about themselves, as much
 * as they let the viewer see. Public pieces show even signed out.
 */
const Page: NextPageWithLayout = () => {
  const { t } = useTranslation();
  const { query, push } = useRouter();
  const userId = typeof query.id === 'string' ? query.id : '';
  const { data: profile, isLoading, isError } = useProfile(userId);

  let body;
  if (isLoading || !userId) {
    body = <Loading />;
  } else if (isError || !profile) {
    body = (
      <Text $variation="secondary">
        {t('This profile isn’t shown to you.', {
          description: 'Profile hidden from the viewer',
        })}
      </Text>
    );
  } else {
    body = (
      <Box $gap="md" data-testid="profile">
        <Box $direction="row" $align="center" $gap="sm">
          <Box
            $css={css`
              transform: scale(1.8);
              transform-origin: left center;
              margin-right: 24px;
            `}
          >
            <UserAvatar fullName={profile.full_name} />
          </Box>
          <Box $css="min-width: 0;" $flex={1}>
            <Text as="h1" $size="h3" $weight="700" $margin="none">
              {profile.full_name}
            </Text>
          </Box>
          {profile.is_me && (
            <Button
              size="small"
              variant="secondary"
              icon={<Icon iconName="edit" $size="18px" $color="inherit" />}
              onClick={() => void push('/account/profile/')}
            >
              {t('Edit my profile', {
                description: 'Button opening the profile settings',
              })}
            </Button>
          )}
        </Box>
        {/* Collaborators: every piece's title; its content as its owner
            lets the viewer see it */}
        <Box $gap="sm" data-testid="profile-fields">
          {(
            [
              [
                'email',
                t('Email', { description: 'Profile field' }),
                profile.email && <Detail icon="mail">{profile.email}</Detail>,
              ],
              [
                'website',
                t('Website', { description: 'Profile field' }),
                profile.website && (
                  <Box $direction="row" $align="center" $gap="2xs">
                    <Icon iconName="link" $size="18px" $variation="secondary" />
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      <Text $size="sm" $theme="brand">
                        {profile.website.replace(/^https?:\/\//, '')}
                      </Text>
                    </a>
                  </Box>
                ),
              ],
              [
                'interests',
                <InterestsTitle key="title" />,
                profile.interests.length > 0 && (
                  <Box $direction="row" $gap="2xs" $css="flex-wrap: wrap;">
                    {profile.interests.map((name) => (
                      <LabelChip key={name} name={name} />
                    ))}
                  </Box>
                ),
              ],
              [
                'headline',
                t('Headline', { description: 'Profile field' }),
                profile.headline && <Text $size="sm">{profile.headline}</Text>,
              ],
              [
                'organization',
                t('Organisation', { description: 'Profile field' }),
                profile.organization && (
                  <Text $size="sm">{profile.organization}</Text>
                ),
              ],
              [
                'location',
                t('Location', { description: 'Profile field' }),
                profile.location && (
                  <Detail icon="location_on">{profile.location}</Detail>
                ),
              ],
              [
                'bio',
                t('About', { description: 'Profile field: biography' }),
                profile.bio && (
                  <Text $size="sm" $css="white-space: pre-wrap;">
                    {profile.bio}
                  </Text>
                ),
              ],
            ] as const
          ).map(([field, title, content]) => {
            const hidden = (profile.hidden ?? []).includes(field);
            if (!hidden && !content) {
              return null;
            }
            return (
              <Box key={field} $gap="3xs">
                <Text $size="sm" $weight="700">
                  {title}
                </Text>
                {hidden ? (
                  <Text
                    $size="sm"
                    $variation="secondary"
                    $css="font-style: italic;"
                  >
                    {t('Not shared with you', {
                      description: 'A profile piece hidden from the viewer',
                    })}
                  </Text>
                ) : (
                  content
                )}
              </Box>
            );
          })}
        </Box>
        {/* Collaborators: last, always titled; each item as its own
            visibility lets the viewer see it */}
        <Box
          $gap="sm"
          data-testid="profile-collaborations"
          $css={css`
            border-top: 1px solid
              var(--c--contextuals--border--surface--primary);
            padding-top: var(--c--globals--spacings--sm);
          `}
        >
          {(
            [
              [
                'workspaces',
                t('WorkSpaces', {
                  description: 'Heading of a list of workspaces',
                }),
                'workspaces',
                profile.workspaces.map((item) => ({
                  id: item.id,
                  name: item.name,
                  href: '',
                })),
              ],
              [
                'spaces',
                t('Spaces', { description: 'Heading of a list of spaces' }),
                'folder',
                (profile.spaces ?? []).map((item) => ({
                  id: item.id,
                  name: item.title,
                  href: `/docs/${item.id}/`,
                })),
              ],
              [
                'pages',
                t('Pages', { description: 'Heading of a list of pages' }),
                'description',
                (profile.pages ?? []).map((item) => ({
                  id: item.id,
                  name: item.title,
                  href: `/docs/${item.id}/`,
                })),
              ],
            ] as const
          ).map(([key, heading, icon, items]) => (
            <Box key={key} $gap="2xs">
              <Text $size="sm" $weight="700">
                {heading}
              </Text>
              {items.length === 0 && (
                <Text $size="sm" $variation="secondary">
                  {t('None to show', {
                    description: 'Empty list of a profile',
                  })}
                </Text>
              )}
              {items.map((item) => {
                const detail = (
                  <Detail icon={icon}>
                    {item.name ||
                      t('Untitled page', {
                        description: 'Name of a page without title',
                      })}
                  </Detail>
                );
                return item.href ? (
                  <StyledLink key={item.id} href={item.href}>
                    {detail}
                  </StyledLink>
                ) : (
                  <Box key={item.id}>{detail}</Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Head>
        <title>{`${profile?.full_name || 'Profile'} - Collaborators`}</title>
      </Head>
      <Box
        as="main"
        $width="100%"
        $maxWidth={SCREEN_MAX_WIDTH}
        $margin={{ horizontal: 'auto' }}
        $padding={{ horizontal: 'md', vertical: 'lg' }}
        $gap="lg"
      >
        <StyledLink href="/">
          <Title headingLevel="h2" $size="1.4rem" />
        </StyledLink>
        {body}
      </Box>
    </>
  );
};

export default Page;
