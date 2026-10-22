import { useDraggable } from '@dnd-kit/core';
import { DropdownMenu, DropdownMenuItem } from '@gouvfr-lasuite/ui-components';
import { useTranslation } from 'react-i18next';

import { Icon } from '@/components';

import { Column } from './model';

/**
 * Collaborators: the handle of the header row, in the page margin left of
 * it like a row's. The header row stays on top: it isn't moved, only
 * formatted as a whole or hidden.
 */
export const HeaderRowControls = ({
  box,
  menuOptions,
  isMenuOpen,
  onMenuOpenChange,
}: {
  box: { top: number; height: number };
  menuOptions: DropdownMenuItem[];
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
}) => {
  const { t } = useTranslation();
  return (
    <div
      className="loop-table__row-controls loop-table__header-controls"
      style={box}
    >
      <DropdownMenu
        options={menuOptions}
        isOpen={isMenuOpen}
        onOpenChange={onMenuOpenChange}
      >
        <button
          type="button"
          className={`loop-table__handle ${isMenuOpen ? 'is-open' : ''}`}
          aria-label={t('Header row actions', {
            description: 'Accessible name of the header row menu button',
          })}
          title={t('Header row', {
            description: 'Tooltip of the header row menu button',
          })}
          onClick={() => onMenuOpenChange(!isMenuOpen)}
        >
          <Icon iconName="more_vert" $size="16px" />
        </button>
      </DropdownMenu>
    </div>
  );
};

/**
 * Collaborators: the handles of a column, on its top edge: "⋮⋮" moves the
 * column sideways, "⋮" formats the whole column, adds, hides or deletes
 * columns.
 */
export const ColumnControls = ({
  column,
  canDrag,
  box,
  menuOptions,
  isMenuOpen,
  onMenuOpenChange,
}: {
  column: Column;
  canDrag: boolean;
  box: { top: number; left: number; width: number };
  menuOptions: DropdownMenuItem[];
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
}) => {
  const { t } = useTranslation();
  const drag = useDraggable({ id: `col:${column.id}`, disabled: !canDrag });
  return (
    <div className="loop-table__column-controls" style={box}>
      <div className="loop-table__column-controls-pill">
        <span
          className="loop-table__handle"
          aria-label={t('Move the {{name}} column', {
            description: 'Accessible name of a column drag handle',
            name: column.name,
          })}
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
        >
          <Icon iconName="drag_indicator" $size="16px" />
        </span>
        <DropdownMenu
          options={menuOptions}
          isOpen={isMenuOpen}
          onOpenChange={onMenuOpenChange}
        >
          <button
            type="button"
            className={`loop-table__handle ${isMenuOpen ? 'is-open' : ''}`}
            aria-label={t('{{name}} column actions', {
              description: 'Accessible name of a column menu button',
              name: column.name,
            })}
            onClick={() => onMenuOpenChange(!isMenuOpen)}
          >
            <Icon iconName="more_vert" $size="16px" />
          </button>
        </DropdownMenu>
      </div>
    </div>
  );
};
