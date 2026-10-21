import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, Icon, StyledLink, Text } from '@/components';
import { useCunninghamTheme } from '@/cunningham';
import { DocDefaultFilter, useTrans } from '@/docs/doc-management';
import { orderItems, useSidebarOrder } from '@/features/dashboard/api';
import { useLeftPanelStore } from '@/features/left-panel';
import ClockIcon from '@/icons/clock.svg';
import SharedIcon from '@/icons/shared.svg';
import StarIcon from '@/icons/star.svg';
import TrashIcon from '@/icons/trash.svg';
import UserIcon from '@/icons/user.svg';
import { useResponsiveStore } from '@/stores/useResponsiveStore';

/** An item one can drag above or below the others. */
const SortableItem = ({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) => {
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      {...drag.attributes}
      role={undefined}
      tabIndex={undefined}
      style={{
        opacity: drag.isDragging ? 0.5 : 1,
        transform: drag.transform
          ? `translate(0, ${drag.transform.y}px)`
          : undefined,
        position: 'relative',
        zIndex: drag.isDragging ? 10 : undefined,
        borderRadius: 4,
        boxShadow:
          drop.isOver && !drag.isDragging
            ? '0 0 0 2px var(--c--globals--colors--brand-400)'
            : undefined,
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  );
};

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
    id: string;
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
      id: 'recent',
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
      id: 'notifications',
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
      id: 'labels',
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
      id: 'explore',
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
      id: 'owned',
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
      id: 'shared',
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
      id: 'starred',
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
      id: 'trashbin',
      label: transFilter(DocDefaultFilter.TRASHBIN),
      targetQuery: DocDefaultFilter.TRASHBIN,
    },
  ];

  // The order the collaborator chose, kept on the server
  const { query: savedOrder, save } = useSidebarOrder();
  // The trash is the last item, and stays there
  const movable = defaultQueries.filter((query) => query.id !== 'trashbin');
  const trash = defaultQueries[defaultQueries.length - 1];
  const ordered = orderItems(movable, savedOrder.data ?? []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    const ids = ordered.map((query) => query.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) {
      return;
    }
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    save.mutate(ids);
  };

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        {[...ordered, trash].map((query) => {
          const isActive = query.href
            ? pathname?.startsWith(query.href.replace(/\/$/, ''))
            : target === query.targetQuery;
          const href =
            query.href ??
            buildHref(query.targetQuery ?? DocDefaultFilter.ALL_DOCS);

          const link = (
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
          // The trash stays last; the others can be dragged into any order
          return query.id === 'trashbin' ? (
            <Box key={query.id}>{link}</Box>
          ) : (
            <SortableItem key={query.id} id={query.id}>
              {link}
            </SortableItem>
          );
        })}
      </DndContext>
    </Box>
  );
};
