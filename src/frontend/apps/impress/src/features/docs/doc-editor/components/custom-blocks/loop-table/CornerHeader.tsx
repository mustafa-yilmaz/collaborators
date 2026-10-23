import { DropdownMenu } from '@gouvfr-lasuite/ui-components';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Y from 'yjs';

import { Icon } from '@/components';

import {
  HEADER_DEFAULTS,
  cellFormatMenuItems,
  formatStyle,
} from './formatMenu';
import {
  TableSnapshot,
  mergeFormats,
  setLayout,
  setLayoutFormat,
} from './model';

/** Collaborators: what stands for the numbers column among the columns. */
export const NUMBERS_COLUMN_ID = '__numbers';

const MIN_WIDTH = 32;

/**
 * The top-left cell, the numbers column's header: like any header cell, a
 * click types its title (empty unless typed in), its "⌄" formats it, its
 * right edge resizes the column. The column's own handle is above it.
 */
export const CornerHeader = ({
  table,
  snapshot,
  isEditable,
}: {
  table: Y.Map<unknown>;
  snapshot: TableSnapshot;
  isEditable: boolean;
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const startRef = useRef<{ x: number; width: number } | null>(null);
  const { layout } = snapshot;
  // Its own format, then the header row's
  const look = mergeFormats(layout.corner, layout.header);
  const width = liveWidth ?? layout.numbersWidth;
  const sizing = { width, minWidth: width, maxWidth: width };

  if (!isEditable) {
    return (
      <th
        className="loop-table__rownum"
        aria-label={layout.numbersTitle || '#'}
        style={{ ...sizing, ...formatStyle(look) }}
      >
        <div className="loop-table__header is-readonly">
          <span className="loop-table__header-name">{layout.numbersTitle}</span>
        </div>
      </th>
    );
  }

  return (
    <th
      className="loop-table__rownum"
      data-column-id={NUMBERS_COLUMN_ID}
      style={{ ...sizing, ...formatStyle(look) }}
    >
      {isRenaming ? (
        <input
          autoFocus
          className="loop-table__input"
          defaultValue={layout.numbersTitle}
          aria-label={t('Title of the numbers column', {
            description: 'Loop table numbers column',
          })}
          onBlur={(event) => {
            setLayout(table, { numbersTitle: event.target.value.trim() });
            setIsRenaming(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setIsRenaming(false);
            }
          }}
        />
      ) : (
        <div className="loop-table__header-cell">
          <div
            className="loop-table__header"
            role="button"
            tabIndex={0}
            onClick={() => setIsRenaming(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === 'F2') {
                event.preventDefault();
                setIsRenaming(true);
              }
            }}
            aria-label={t('Numbers column. Type to give it a title', {
              description: 'Accessible name of the numbers column header',
            })}
          >
            <span className="loop-table__header-name">
              {layout.numbersTitle}
            </span>
          </div>
          <DropdownMenu
            options={cellFormatMenuItems(
              t,
              layout.corner,
              (patch) => setLayoutFormat(table, 'corner', patch),
              mergeFormats(layout.header, HEADER_DEFAULTS),
            )}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
          >
            <button
              type="button"
              className="loop-table__cell-chevron"
              aria-label={t('Format this cell', {
                description: 'Accessible name of the Loop table cell menu',
              })}
              title={t('Format this cell', {
                description: 'Accessible name of the Loop table cell menu',
              })}
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(!isOpen);
              }}
            >
              <Icon iconName="expand_more" $size="16px" />
            </button>
          </DropdownMenu>
        </div>
      )}
      <div
        className={`loop-table__resize ${liveWidth !== null ? 'is-resizing' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('Resize the numbers column', {
          description: 'Accessible name of a column resize handle',
        })}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setLayout(table, {
              numbersWidth: Math.max(
                MIN_WIDTH,
                layout.numbersWidth + (event.key === 'ArrowLeft' ? -8 : 8),
              ),
            });
          }
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          (event.target as HTMLElement).setPointerCapture(event.pointerId);
          startRef.current = { x: event.clientX, width: layout.numbersWidth };
          setLiveWidth(layout.numbersWidth);
        }}
        onPointerMove={(event) => {
          if (startRef.current) {
            setLiveWidth(
              Math.max(
                MIN_WIDTH,
                startRef.current.width + event.clientX - startRef.current.x,
              ),
            );
          }
        }}
        onPointerUp={() => {
          if (startRef.current && liveWidth !== null) {
            setLayout(table, { numbersWidth: Math.round(liveWidth) });
          }
          startRef.current = null;
          setLiveWidth(null);
        }}
      />
    </th>
  );
};
