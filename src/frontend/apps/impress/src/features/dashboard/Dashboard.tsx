import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { Box, BoxButton, Icon, Text } from '@/components';
import { useAuth } from '@/features/auth';
import { useResponsiveStore } from '@/stores';

import { CardLayout, useDashboardLayout } from './api';
import { CARDS, DEFAULT_LAYOUT, mergeLayout } from './cards';

const IconButton = ({
  icon,
  label,
  onClick,
  disabled,
  ...rest
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
} & Record<string, unknown>) => (
  <BoxButton
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    $padding="3xs"
    $css="border-radius: 4px; touch-action: none;"
    {...rest}
  >
    <Icon iconName={icon} $size="20px" $variation="secondary" />
  </BoxButton>
);

interface DashboardCardProps {
  card: CardLayout;
  index: number;
  count: number;
  onChange: (changes: Partial<CardLayout>) => void;
  onMove: (to: number) => void;
}

/** A card's handle and menu show on hover (or keyboard focus) only. */
const cardCss = css`
  .--collaborators--card-tool {
    visibility: hidden;
  }
  &:hover .--collaborators--card-tool,
  &:focus-within .--collaborators--card-tool,
  .--collaborators--card-tool[aria-expanded='true'] {
    visibility: visible;
  }
`;

/**
 * The cards shown, cut into runs of cards side by side and wide cards; each
 * keeps its place in the whole order (for moving it up or down).
 */
export const sections = (cards: CardLayout[], isMobile: boolean) =>
  cards.reduce<
    { wide: boolean; items: { card: CardLayout; index: number }[] }[]
  >((result, card, index) => {
    const wide = !!card.wide && !isMobile;
    const last = result[result.length - 1];
    if (!wide && last && !last.wide) {
      last.items.push({ card, index });
    } else {
      result.push({ wide, items: [{ card, index }] });
    }
    return result;
  }, []);

const DashboardCard = ({
  card,
  index,
  count,
  onChange,
  onMove,
}: DashboardCardProps) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsiveStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const definition = CARDS.find((item) => item.id === card.id);
  const drag = useDraggable({ id: card.id });
  const drop = useDroppable({ id: card.id });
  if (!definition) {
    return null;
  }
  const title = definition.title(t);
  const Body = definition.Body;
  const menu: DropdownMenuItem[] = [
    {
      label: t('Move up', { description: 'Dashboard card action' }),
      icon: <Icon iconName="arrow_upward" $size="18px" />,
      isDisabled: index === 0,
      callback: () => onMove(index - 1),
    },
    {
      label: t('Move down', { description: 'Dashboard card action' }),
      icon: <Icon iconName="arrow_downward" $size="18px" />,
      isDisabled: index === count - 1,
      callback: () => onMove(index + 1),
    },
    {
      label: card.wide
        ? t('Show in one column', { description: 'Dashboard card action' })
        : t('Show across both columns', {
            description: 'Dashboard card action',
          }),
      icon: (
        <Icon
          iconName={card.wide ? 'view_column' : 'width_full'}
          $size="18px"
        />
      ),
      callback: () => onChange({ wide: !card.wide }),
    },
    { type: 'separator' },
    {
      label: t('Hide this card', { description: 'Dashboard card action' }),
      icon: <Icon iconName="visibility_off" $size="18px" />,
      callback: () => onChange({ hidden: true }),
    },
  ];

  return (
    <Box
      as="section"
      ref={drop.setNodeRef}
      aria-label={title}
      $css={css`
        border: 1px solid var(--c--contextuals--border--surface--primary);
        border-radius: var(--c--globals--spacings--xs);
        background: var(--c--contextuals--background--surface--primary);
        padding: var(--c--globals--spacings--xs);
        opacity: ${drag.isDragging ? 0.5 : 1};
        box-shadow: ${
          drop.isOver && !drag.isDragging
            ? '0 0 0 2px var(--c--globals--colors--brand-400)'
            : 'none'
        };
        transform: ${
          drag.transform
            ? `translate(${drag.transform.x}px, ${drag.transform.y}px)`
            : 'none'
        };
        z-index: ${drag.isDragging ? 10 : 'auto'};
        position: relative;
        ${cardCss}
      `}
    >
      <Box $direction="row" $align="center" $gap="2xs">
        <span
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          className="--collaborators--card-tool"
          aria-label={t('Move the {{name}} card', {
            description: 'Accessible name of a dashboard card drag handle',
            name: title,
          })}
          title={t('Drag to move', {
            description: 'Tooltip of a dashboard card drag handle',
          })}
          style={{
            cursor: 'grab',
            display: 'inline-flex',
            touchAction: 'none',
          }}
        >
          <Icon iconName="drag_indicator" $size="20px" $variation="secondary" />
        </span>
        <Icon iconName={definition.icon} $size="20px" $variation="secondary" />
        <Text as="h2" $size="md" $weight="700" $margin="none" $css="flex: 1;">
          {title}
        </Text>
        <DropdownMenu
          options={menu}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
          <IconButton
            icon="more_horiz"
            label={t('{{name}} options', {
              description: 'Dashboard card menu button',
              name: title,
            })}
            className="--collaborators--card-tool"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          />
        </DropdownMenu>
        <IconButton
          icon={card.collapsed ? 'expand_more' : 'expand_less'}
          label={
            card.collapsed
              ? t('Expand {{name}}', {
                  description: 'Dashboard card action',
                  name: title,
                })
              : t('Collapse {{name}}', {
                  description: 'Dashboard card action',
                  name: title,
                })
          }
          aria-expanded={!card.collapsed}
          onClick={() => onChange({ collapsed: !card.collapsed })}
        />
      </Box>
      {!card.collapsed && (
        <Box $margin={{ top: 'xs' }} $gap="4xs">
          <Body wide={!!card.wide && !isMobile} />
        </Box>
      )}
    </Box>
  );
};

/**
 * The landing screen after sign-in: lean by default (search and three
 * cards). Each collaborator collapses, hides, shows and reorders cards right
 * there: drag a card by its handle, or use its "⋯" menu.
 */
export const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isMobile } = useResponsiveStore();
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const { query, save } = useDashboardLayout();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  if (!query.isFetched) {
    return null;
  }
  const layout = mergeLayout(query.data ?? []);
  const visible = layout.filter((card) => !card.hidden);
  const hidden = layout.filter((card) => card.hidden);

  const update = (next: CardLayout[]) => save.mutate(next);
  const change = (id: string, changes: Partial<CardLayout>) =>
    update(
      layout.map((card) => (card.id === id ? { ...card, ...changes } : card)),
    );
  /** Move a visible card to another place among the visible cards. */
  const move = (id: string, toVisibleIndex: number) => {
    const target = visible[toVisibleIndex];
    if (!target || target.id === id) {
      return;
    }
    const moving = layout.find((card) => card.id === id);
    if (!moving) {
      return;
    }
    const rest = layout.filter((card) => card.id !== id);
    const at = rest.findIndex((card) => card.id === target.id);
    const from = visible.findIndex((card) => card.id === id);
    rest.splice(from < toVisibleIndex ? at + 1 : at, 0, moving);
    update(rest);
  };
  const onDragEnd = (event: DragEndEvent) => {
    if (event.over && event.over.id !== event.active.id) {
      move(
        String(event.active.id),
        visible.findIndex((card) => card.id === event.over?.id),
      );
    }
  };

  const firstName = user?.short_name || user?.full_name?.split(' ')[0];
  const renderCard = ({ card, index }: { card: CardLayout; index: number }) => (
    <DashboardCard
      key={card.id}
      card={card}
      index={index}
      count={visible.length}
      onChange={(changes) => change(card.id, changes)}
      onMove={(to) => move(card.id, to)}
    />
  );

  return (
    <Box
      $width="100%"
      $maxWidth="1100px"
      $margin={{ horizontal: 'auto' }}
      $padding={{ horizontal: isMobile ? 'sm' : 'lg', vertical: 'lg' }}
      $gap="md"
      className="--collaborators--dashboard"
    >
      <Box
        $direction="row"
        $align="center"
        $justify="space-between"
        $gap="sm"
        $css="flex-wrap: wrap;"
      >
        <Text as="h1" $size="h4" $margin="none">
          {firstName
            ? t('Welcome back, {{name}}', {
                description: 'Dashboard greeting',
                name: firstName,
              })
            : t('Welcome back', { description: 'Dashboard greeting' })}
        </Text>
      </Box>

      <BoxButton
        onClick={() =>
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true,
              bubbles: true,
            }),
          )
        }
        $direction="row"
        $align="center"
        $gap="xs"
        $width="100%"
        $padding={{ horizontal: 'sm', vertical: 'xs' }}
        $css={css`
          border: 1px solid var(--c--contextuals--border--surface--primary);
          border-radius: var(--c--globals--spacings--xs);
          color: var(--c--contextuals--content--semantic--neutral--secondary);
          text-align: left;
          &:hover {
            border-color: var(--c--globals--colors--brand-400);
          }
        `}
      >
        <Icon iconName="search" $size="20px" $variation="secondary" />
        <Text $size="sm" $variation="secondary" $css="flex: 1;">
          {t('Search pages…', { description: 'Dashboard search box' })}
        </Text>
        <Text $size="xs" $variation="secondary">
          ⌘K
        </Text>
      </BoxButton>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <Box $gap="sm" className="--collaborators--dashboard-columns">
          {/* Runs of cards in two columns that stack independently (cards
              in turn left and right), a wide card across both; one column
              on phones */}
          {sections(visible, isMobile).map((section) =>
            section.wide ? (
              renderCard(section.items[0])
            ) : (
              <Box
                key={section.items[0].card.id}
                $direction="row"
                $gap="sm"
                $align="flex-start"
              >
                {(isMobile ? [0] : [0, 1]).map((column) => (
                  <Box key={column} $flex={1} $gap="sm" $css="min-width: 0;">
                    {section.items
                      .filter(
                        (_item, position) =>
                          isMobile || position % 2 === column,
                      )
                      .map(renderCard)}
                  </Box>
                ))}
              </Box>
            ),
          )}
        </Box>
      </DndContext>

      {/* Hidden cards come back from here; the layout can be reset too */}
      <Box $direction="row">
        <DropdownMenu
          options={[
            ...hidden.flatMap((card) => {
              const definition = CARDS.find((item) => item.id === card.id);
              return definition
                ? [
                    {
                      label: definition.title(t),
                      icon: <Icon iconName={definition.icon} $size="18px" />,
                      callback: () => change(card.id, { hidden: false }),
                    },
                  ]
                : [];
            }),
            ...(hidden.length ? [{ type: 'separator' as const }] : []),
            {
              label: t('Reset the dashboard', {
                description: 'Dashboard action putting the default cards back',
              }),
              icon: <Icon iconName="restart_alt" $size="18px" />,
              callback: () => update(DEFAULT_LAYOUT),
            },
          ]}
          isOpen={isAddMenuOpen}
          onOpenChange={setIsAddMenuOpen}
        >
          <BoxButton
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            aria-expanded={isAddMenuOpen}
            $direction="row"
            $align="center"
            $gap="3xs"
            $padding={{ horizontal: 'xs', vertical: '3xs' }}
            $css={css`
              border-radius: var(--c--globals--spacings--3xs);
              color: var(
                --c--contextuals--content--semantic--neutral--secondary
              );
              &:hover {
                background: var(
                  --c--contextuals--background--semantic--contextual--primary
                );
              }
            `}
          >
            <Icon iconName="add" $size="18px" $color="inherit" />
            <Text $size="sm" $color="inherit">
              {t('Add a card', { description: 'Dashboard hidden cards menu' })}
            </Text>
          </BoxButton>
        </DropdownMenu>
      </Box>
    </Box>
  );
};
