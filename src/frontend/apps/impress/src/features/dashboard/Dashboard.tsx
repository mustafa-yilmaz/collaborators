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
import { Button } from '@gouvfr-lasuite/ui-components';
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
  isCustomizing: boolean;
  onChange: (changes: Partial<CardLayout>) => void;
  onMove: (to: number) => void;
}

const DashboardCard = ({
  card,
  index,
  count,
  isCustomizing,
  onChange,
  onMove,
}: DashboardCardProps) => {
  const { t } = useTranslation();
  const definition = CARDS.find((item) => item.id === card.id);
  const drag = useDraggable({ id: card.id, disabled: !isCustomizing });
  const drop = useDroppable({ id: card.id });
  if (!definition) {
    return null;
  }
  const title = definition.title(t);
  const Body = definition.Body;

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
      `}
    >
      <Box $direction="row" $align="center" $gap="2xs">
        {isCustomizing && (
          <span
            ref={drag.setNodeRef}
            {...drag.listeners}
            {...drag.attributes}
            aria-label={t('Move the {{name}} card', {
              description: 'Accessible name of a dashboard card drag handle',
              name: title,
            })}
            style={{ cursor: 'grab', display: 'inline-flex' }}
          >
            <Icon
              iconName="drag_indicator"
              $size="20px"
              $variation="secondary"
            />
          </span>
        )}
        <Icon iconName={definition.icon} $size="20px" $variation="secondary" />
        <Text as="h2" $size="md" $weight="700" $margin="none" $css="flex: 1;">
          {title}
        </Text>
        {isCustomizing && (
          <>
            <IconButton
              icon="arrow_upward"
              label={t('Move up', { description: 'Dashboard card action' })}
              disabled={index === 0}
              onClick={() => onMove(index - 1)}
            />
            <IconButton
              icon="arrow_downward"
              label={t('Move down', { description: 'Dashboard card action' })}
              disabled={index === count - 1}
              onClick={() => onMove(index + 1)}
            />
            <IconButton
              icon="visibility_off"
              label={t('Hide {{name}}', {
                description: 'Dashboard card action',
                name: title,
              })}
              onClick={() => onChange({ hidden: true })}
            />
          </>
        )}
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
          <Body />
        </Box>
      )}
    </Box>
  );
};

/**
 * The landing screen after sign-in: lean by default (search and three
 * cards), and each collaborator can collapse, hide, show and reorder cards.
 */
export const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isMobile } = useResponsiveStore();
  const [isCustomizing, setIsCustomizing] = useState(false);
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
        <Box $direction="row" $gap="xs" $align="center">
          {isCustomizing && (
            <Button
              size="small"
              variant="tertiary"
              onClick={() => update(DEFAULT_LAYOUT)}
            >
              {t('Reset to default', { description: 'Dashboard action' })}
            </Button>
          )}
          <Button
            size="small"
            variant={isCustomizing ? 'primary' : 'secondary'}
            icon={
              <Icon
                iconName={isCustomizing ? 'check' : 'tune'}
                $size="18px"
                $color="inherit"
              />
            }
            onClick={() => setIsCustomizing(!isCustomizing)}
          >
            {isCustomizing
              ? t('Done', { description: 'Dashboard action' })
              : t('Customize', { description: 'Dashboard action' })}
          </Button>
        </Box>
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
        <Box
          $css={css`
            display: grid;
            grid-template-columns: ${isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))'};
            gap: var(--c--globals--spacings--sm);
            align-items: start;
          `}
        >
          {visible.map((card, index) => (
            <DashboardCard
              key={card.id}
              card={card}
              index={index}
              count={visible.length}
              isCustomizing={isCustomizing}
              onChange={(changes) => change(card.id, changes)}
              onMove={(to) => move(card.id, to)}
            />
          ))}
        </Box>
      </DndContext>

      {isCustomizing && hidden.length > 0 && (
        <Box $gap="xs">
          <Text as="h2" $size="sm" $weight="600" $margin="none">
            {t('Add a card', { description: 'Dashboard hidden cards heading' })}
          </Text>
          <Box $direction="row" $gap="xs" $css="flex-wrap: wrap;">
            {hidden.map((card) => {
              const definition = CARDS.find((item) => item.id === card.id);
              return definition ? (
                <Button
                  key={card.id}
                  size="small"
                  variant="secondary"
                  icon={<Icon iconName="add" $size="18px" $color="inherit" />}
                  onClick={() => change(card.id, { hidden: false })}
                >
                  {definition.title(t)}
                </Button>
              ) : null;
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};
