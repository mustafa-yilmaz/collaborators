import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocDefaultFilter, useTrans } from '@/docs/doc-management';
import { useLeftPanelStore } from '@/features/left-panel';
import ClockIcon from '@/icons/clock.svg';
import SharedIcon from '@/icons/shared.svg';
import StarIcon from '@/icons/star.svg';
import TrashIcon from '@/icons/trash.svg';
import UserIcon from '@/icons/user.svg';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

/** The directory of workspaces one may join */
const DISCOVER_PATH = '/workspaces/discover/';

export const LeftPanelTargetFilters = () => {
  const { t } = useTranslation();
  const { transFilter } = useTrans();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isMobile } = useResponsiveStore();
  const { closePanel } = useLeftPanelStore();
  const { colorsTokens, spacingsTokens } = useCunninghamTheme();

  // No list is highlighted on the dashboard (no target)
  const target = searchParams.get('target') as DocDefaultFilter | null;

  // "My collaborations": what one is involved in, then the trash
  const defaultQueries: {
    icon: ReactNode;
    label: string;
    targetQuery?: DocDefaultFilter;
    href?: string;
  }[] = [
    {
      icon: (
        <Icon
          icon={<ClockIcon width={20} height={20} aria-hidden="true" />}
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.ALL_DOCS),
      targetQuery: DocDefaultFilter.ALL_DOCS,
    },
    {
      icon: (
        <Icon
          iconName="notifications"
          $size="20px"
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.NOTIFICATIONS),
      targetQuery: DocDefaultFilter.NOTIFICATIONS,
    },
    {
      icon: (
        <Icon
          iconName="sell"
          $size="20px"
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.LABELS),
      targetQuery: DocDefaultFilter.LABELS,
    },
    // What is open to join or read: the "Explore collaborations" screen
    {
      icon: (
        <Icon
          iconName="travel_explore"
          $size="20px"
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: t('Explore', {
        description: 'Left panel entry opening the directory of collaborations',
      }),
      href: DISCOVER_PATH,
    },
    {
      icon: (
        <Icon
          icon={<UserIcon width={20} height={20} aria-hidden="true" />}
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.MY_DOCS),
      targetQuery: DocDefaultFilter.MY_DOCS,
    },
    {
      icon: (
        <Icon
          icon={<SharedIcon width={20} height={20} aria-hidden="true" />}
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.SHARED_WITH_ME),
      targetQuery: DocDefaultFilter.SHARED_WITH_ME,
    },
    {
      icon: (
        <Icon
          icon={<StarIcon width={20} height={20} aria-hidden="true" />}
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.STARRED),
      targetQuery: DocDefaultFilter.STARRED,
    },
    {
      icon: (
        <Icon
          icon={<TrashIcon width={20} height={20} aria-hidden="true" />}
          $padding="4xs"
          $variation="tertiary"
        />
      ),
      label: transFilter(DocDefaultFilter.TRASHBIN),
      targetQuery: DocDefaultFilter.TRASHBIN,
    },
  ];

  const buildHref = (query: DocDefaultFilter) => {
    const params = new URLSearchParams(searchParams);
    params.set('target', query);
    return `${pathname}?${params.toString()}`;
  };

  const handleFilterClick = () => {
    if (isMobile) {
      closePanel();
    }
  };

  return (
    <Box
      $justify="center"
      $padding={{ horizontal: 'sm' }}
      $gap={spacingsTokens['2xs']}
      className="--docs--left-panel-target-filters"
    >
      {defaultQueries.map((query) => {
        const isActive = query.href
          ? pathname?.startsWith(query.href.replace(/\/$/, ''))
          : target === query.targetQuery;
        const href =
          query.href ??
          buildHref(query.targetQuery ?? DocDefaultFilter.ALL_DOCS);

        return (
          <StyledLink
            key={query.label}
            href={href}
            aria-label={query.label}
            aria-current={isActive ? 'page' : undefined}
            onClick={handleFilterClick}
            $css={css`
              align-items: center;
              justify-content: flex-start;
              gap: var(--c--globals--spacings--3xs);
              padding: var(--c--globals--spacings--2xs);
              border-radius: var(--c--globals--spacings--3xs);
              background-color: ${
                isActive
                  ? 'var(--c--contextuals--background--semantic--contextual--primary)'
                  : 'transparent'
              };
              font-weight: 500;
              color: inherit;
              text-decoration: none;
              &:hover {
                background-color: var(
                  --c--contextuals--background--semantic--contextual--primary
                );
              }
              &:focus-visible {
                outline: none !important;
                box-shadow: 0 0 0 2px ${colorsTokens['brand-400']} !important;
                border-radius: var(--c--globals--spacings--st);
              }
            `}
          >
            {query.icon}
            <Text $size="sm">{query.label}</Text>
          </StyledLink>
        );
      })}
    </Box>
  );
};
