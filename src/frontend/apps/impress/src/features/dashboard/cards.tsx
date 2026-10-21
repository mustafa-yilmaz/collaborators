import type { TFunction } from 'i18next';
import { ReactNode } from 'react';

import { Box } from '@/components';
import { CollaborationsList } from '@/features/collaborations/CollaborationsList';
import { CollaborationsView } from '@/features/collaborations/api';
import { DocDefaultFilter } from '@/features/docs/doc-management';
import { ForMeList } from '@/features/notifications/ForMeList';

import { SeeAll } from './CardParts';
import { CardLayout } from './api';

export interface CardDefinition {
  id: string;
  icon: string;
  title: (t: TFunction<'translation', undefined>) => string;
  /** Shown on a fresh dashboard; the others can be added. */
  defaultVisible: boolean;
  /** Across both columns on a fresh dashboard */
  defaultWide?: boolean;
  Body: (props: BodyProps) => ReactNode;
}

/** What a card's body knows of its card: whether it goes across. */
export interface BodyProps {
  wide?: boolean;
}

/** How many of each group (workspaces, spaces, pages) a list card shows. */
export const LIST_CARD_SIZE = 3;

/**
 * A card summing up a list of "My collaborations" in the left panel: the
 * same lists, the first of each group, and a link to the whole of it.
 */
const listCard =
  (view: CollaborationsView, target: DocDefaultFilter) =>
  ({ wide }: BodyProps) => (
    <Box $gap="xs">
      <CollaborationsList view={view} summary={LIST_CARD_SIZE} wide={wide} />
      <SeeAll href={`/?target=${target}`} />
    </Box>
  );

/**
 * Every card the dashboard can show, in their default order. Cards sit in two
 * columns, in turn left and right, and a wide card goes across both: by
 * default Notifications across, then Recent across, under it. The others are
 * added from "Add a card", in this order.
 */
export const CARDS: CardDefinition[] = [
  // Mentions, notifications and assignments, as in the bell
  {
    id: 'notifications',
    icon: 'notifications',
    title: (t) => t('Notifications', { description: 'Dashboard card' }),
    defaultVisible: true,
    defaultWide: true,
    Body: function NotificationsBody() {
      return <ForMeList />;
    },
  },
  {
    id: 'recent',
    icon: 'schedule',
    title: (t) => t('Recent', { description: 'Dashboard card' }),
    defaultVisible: true,
    defaultWide: true,
    Body: listCard('recent', DocDefaultFilter.ALL_DOCS),
  },
  // The id of the former Favorites card, so saved layouts keep it
  {
    id: 'favorites',
    icon: 'star',
    title: (t) => t('Starred', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: listCard('starred', DocDefaultFilter.STARRED),
  },
  {
    id: 'owned',
    icon: 'person',
    title: (t) => t('Owned by me', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: listCard('owned', DocDefaultFilter.MY_DOCS),
  },
  {
    id: 'shared',
    icon: 'group',
    title: (t) => t('Shared with me', { description: 'Dashboard card' }),
    defaultVisible: false,
    Body: listCard('shared', DocDefaultFilter.SHARED_WITH_ME),
  },
];

export const DEFAULT_LAYOUT = CARDS.map((card) => ({
  id: card.id,
  hidden: !card.defaultVisible,
  collapsed: false,
  wide: !!card.defaultWide,
}));

/**
 * The saved layout, completed with the cards added since it was saved: those
 * shown on a fresh dashboard appear where they stand by default (before the
 * card that follows them there), the others stay hidden. The order someone
 * chose is kept; cards no longer offered (Labels, My spaces...) are dropped.
 */
export const mergeLayout = (saved: CardLayout[]) => {
  // Saved while Labels stood beside it: Notifications now goes across
  const besideLabels = saved.some((card) => card.id === 'labels');
  const known = saved
    .filter((card) => CARDS.some((def) => def.id === card.id))
    .map((card) =>
      besideLabels && card.id === 'notifications'
        ? { ...card, wide: true }
        : card,
    );
  if (!known.length) {
    return DEFAULT_LAYOUT;
  }
  const merged = [...known];
  DEFAULT_LAYOUT.forEach((card, index) => {
    if (merged.some((item) => item.id === card.id)) {
      return;
    }
    const next = DEFAULT_LAYOUT.slice(index + 1).find((later) =>
      merged.some((item) => item.id === later.id),
    );
    const at = next
      ? merged.findIndex((item) => item.id === next.id)
      : merged.length;
    merged.splice(at, 0, card);
  });
  return merged;
};
