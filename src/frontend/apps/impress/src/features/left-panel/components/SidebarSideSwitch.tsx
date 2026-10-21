import { useTranslation } from 'react-i18next';
import { css } from 'styled-components';

import { BoxButton } from '@/components';

import { useSidebarSide } from '../stores';

/**
 * A plain slider moving the panel to the other side of the screen: its knob
 * stands on the side the panel is on.
 */
export const SidebarSideSwitch = () => {
  const { t } = useTranslation();
  const { isRight, moveTo } = useSidebarSide();
  const label = isRight
    ? t('Move the sidebar to the left', {
        description: 'Switch putting the left panel back on the left',
      })
    : t('Move the sidebar to the right', {
        description: 'Switch putting the left panel on the right',
      });

  return (
    <BoxButton
      role="switch"
      aria-checked={isRight}
      aria-label={t('Sidebar on the right', {
        description: 'Accessible name of the switch moving the left panel',
      })}
      title={label}
      onClick={() => moveTo(isRight ? 'left' : 'right')}
      data-testid="sidebar-side-switch"
      $position="relative"
      $css={css`
        flex-shrink: 0;
        width: 34px;
        height: 18px;
        border-radius: 9px;
        border: 1px solid var(--c--contextuals--border--surface--primary);
        background: var(
          --c--contextuals--background--semantic--contextual--primary
        );
        &:hover {
          border-color: var(--c--globals--colors--brand-400);
        }
        &:focus-visible {
          outline: 2px solid var(--c--globals--colors--brand-400);
          outline-offset: 2px;
        }
        &::after {
          content: '';
          position: absolute;
          top: 2px;
          /* Where the panel is, whatever the direction of the panel */
          left: ${isRight ? '18px' : '2px'};
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--c--globals--colors--gray-500);
          transition: left 0.15s ease-out;
        }
      `}
    />
  );
};
