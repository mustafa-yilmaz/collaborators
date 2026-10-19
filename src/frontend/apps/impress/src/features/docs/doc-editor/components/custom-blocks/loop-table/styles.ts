import { createGlobalStyle } from 'styled-components';

export const LABEL_COLORS: Record<string, { bg: string; fg: string }> = {
  gray: { bg: '#EEEEF2', fg: '#3E3E4A' },
  blue: { bg: '#E1ECFD', fg: '#1D4E9E' },
  green: { bg: '#DFF3E7', fg: '#1E6B3E' },
  yellow: { bg: '#FDF0D6', fg: '#7A5410' },
  red: { bg: '#FDE2DF', fg: '#9B2A1E' },
  purple: { bg: '#ECE6FB', fg: '#4F3497' },
  pink: { bg: '#FBE4F0', fg: '#8E2A5E' },
};

/** Loop-like look: light borders, quiet header, handles on hover. */
export const LoopTableStyle = createGlobalStyle`
  .loop-table,
  .loop-table__popover {
    --lt-border: var(--c--contextuals--border--surface--primary, #e3e3ec);
    --lt-muted: var(--c--contextuals--content--semantic--neutral--secondary, #6b6b7b);
    --lt-hover: var(--c--contextuals--background--semantic--contextual--primary, #f2f2fa);
    --lt-accent: var(--c--globals--colors--brand-500, #5c5ce6);
    width: 100%;
    font-size: 14px;
    user-select: text;
  }
  .loop-table {
    position: relative;
  }
  /* Spread into the margins: its width and offset are set on the element */
  /* The room of the rows of a very large table that are not drawn */
  .loop-table__grid tr.loop-table__spacer td {
    padding: 0;
    border: none;
    background: transparent;
  }
  .loop-table.is-expanded {
    max-width: none;
    flex: none;
  }
  /* Where the filter panel opens from, when nothing else is shown above */
  .loop-table__toolbar-anchor {
    position: relative;
    height: 0;
  }
  .loop-table__toolbar {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  /* Only the filter panel open: the table doesn't move */
  .loop-table__toolbar:not(:has(> .loop-table__toolbar-button)) {
    margin-bottom: 0;
  }
  .loop-table__toolbar-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: none;
    background: transparent;
    color: var(--lt-muted);
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
  }
  .loop-table__toolbar-button:hover,
  .loop-table__toolbar-button[aria-expanded='true'] {
    background: var(--lt-hover);
  }
  .loop-table__toolbar-separator {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--lt-border);
  }
  .loop-table__toolbar-button.is-active {
    color: var(--lt-accent);
    font-weight: 600;
  }
  .loop-table__badge {
    background: var(--lt-accent);
    color: white;
    border-radius: 999px;
    font-size: 11px;
    padding: 0 6px;
    line-height: 16px;
  }
  .loop-table__scroll {
    overflow-x: auto;
    border: 1px solid var(--lt-border);
    border-radius: 6px;
  }
  .loop-table__grid {
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    min-width: 100%;
  }
  .loop-table__grid th,
  .loop-table__grid td {
    border-right: 1px solid var(--lt-border);
    border-bottom: 1px solid var(--lt-border);
    padding: 0;
    position: relative;
    background: var(--c--contextuals--background--surface--primary, white);
  }
  /* Text sits in the middle of its cell unless chosen otherwise; "table"
     outweighs the editor's own rule for tables (top) */
  table.loop-table__grid th,
  table.loop-table__grid td {
    vertical-align: middle;
  }
  .loop-table__grid th:last-child,
  .loop-table__grid td:last-child {
    border-right: none;
  }
  .loop-table__grid th {
    font-weight: 600;
    text-align: left;
    color: var(--lt-muted);
    font-size: 13px;
    height: 36px;
  }
  /* Row numbers sit like any cell: left and in the middle unless chosen
     otherwise */
  .loop-table__rownum {
    width: 44px;
    min-width: 44px;
    color: var(--lt-muted);
    font-size: 12px;
  }
  .loop-table__rownum-number {
    padding: 7px 8px;
    font-variant-numeric: tabular-nums;
  }
  /* The handle and menu of a row, in the page margin left of the table */
  .loop-table__row-controls {
    position: absolute;
    right: 100%;
    display: flex;
    align-items: center;
    padding-right: 4px;
  }
  .loop-table__row-controls .loop-table__handle {
    visibility: visible;
    padding: 2px;
    border-radius: 4px;
  }
  .loop-table__row-controls .loop-table__handle:hover,
  .loop-table__row-controls .loop-table__handle.is-open {
    background: var(--lt-hover);
  }
  .loop-table__handle {
    visibility: hidden;
    cursor: grab;
    border: none;
    background: transparent;
    color: var(--lt-muted);
    padding: 0;
    display: inline-flex;
    touch-action: none;
  }
  th:hover .loop-table__handle,
  .loop-table__handle:focus-visible {
    visibility: visible;
  }
  /* The menu trigger around a header fills it, so the header's alignment
     (left by default) shows */
  .loop-table__grid th > .c__dropdown-menu-trigger {
    width: 100%;
    justify-content: stretch;
  }
  .loop-table__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    height: 36px;
    width: 100%;
    cursor: pointer;
  }
  .loop-table__header:hover {
    background: var(--lt-hover);
  }
  .loop-table__header.is-readonly {
    cursor: default;
  }
  .loop-table__header.is-readonly:hover {
    background: none;
  }
  .loop-table__header-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .loop-table__resize {
    position: absolute;
    top: 0;
    right: -3px;
    width: 6px;
    height: 100%;
    cursor: col-resize;
    z-index: 2;
  }
  .loop-table__resize:hover,
  .loop-table__resize.is-resizing {
    background: var(--lt-accent);
  }
  .loop-table__cell {
    min-height: 36px;
    padding: 7px 8px;
    outline: none;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .loop-table__cell.is-number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  /* An alignment chosen for the cell, row or column wins */
  .loop-table__grid td[data-align] .loop-table__cell {
    text-align: inherit;
  }
  .loop-table__handle.is-open {
    visibility: visible;
  }
  .loop-table__corner,
  .loop-table__cell-menu {
    border: none;
    background: transparent;
    color: var(--lt-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: inline-flex;
  }
  .loop-table__corner {
    width: 100%;
    height: 36px;
    justify-content: center;
    align-items: center;
  }
  .loop-table__corner:hover,
  .loop-table__cell-menu:hover {
    background: var(--lt-hover);
  }
  .loop-table__cell-menu {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 3;
    background: var(--c--contextuals--background--surface--primary, white);
    box-shadow: 0 0 0 1px var(--lt-border);
  }
  td.is-active {
    box-shadow: inset 0 0 0 2px var(--lt-accent);
  }
  .loop-table__input {
    width: 100%;
    min-height: 36px;
    border: none;
    outline: none;
    padding: 7px 8px;
    font: inherit;
    background: transparent;
    resize: none;
  }
  /* Text cells: the rich editor, its bar and menus, and inline elements */
  .loop-table__rich-input {
    white-space: pre-wrap;
    word-break: break-word;
    cursor: text;
  }
  .loop-table__rich-input p {
    margin: 0;
  }
  .loop-table__link {
    color: var(--c--globals--colors--brand-600, #3e5de7);
    text-decoration: underline;
  }
  .loop-table__inline-image {
    display: inline-block;
    max-width: 100%;
    max-height: 96px;
    vertical-align: middle;
    border-radius: 4px;
    margin: 2px 0;
  }
  .loop-table__rich-input .loop-table__inline-image.ProseMirror-selectednode,
  .loop-table__rich-input .loop-table__token.ProseMirror-selectednode {
    outline: 2px solid var(--c--globals--colors--brand-400, #6a7fea);
  }
  .loop-table__token.is-date {
    background: #eef0f4;
    color: #3e3e4a;
  }
  .loop-table__token.is-page {
    background: #e3edf8;
    color: #1f4e8c;
  }
  .loop-table__token.is-user,
  .loop-table__token.is-group {
    background: #ece6fb;
    color: #4f3497;
  }
  .loop-table__format-bar {
    display: flex;
    gap: 2px;
    padding: 4px;
    min-width: 0;
    z-index: 1000;
  }
  .loop-table__format-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .loop-table__format-button:hover {
    background: var(--lt-hover);
  }
  .loop-table__format-button.is-active {
    background: var(--lt-hover);
    color: var(--c--globals--colors--brand-600, #3e5de7);
  }
  .loop-table__swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px 8px;
  }
  .loop-table__swatch {
    width: 26px;
    height: 26px;
    border: 1px solid var(--lt-border);
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .loop-table__swatch.is-active {
    outline: 2px solid var(--c--globals--colors--brand-400, #6a7fea);
  }
  .loop-table__panel-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 240px;
  }
  .loop-table__panel-form .loop-table__swatches {
    padding: 0;
  }
  .loop-table__panel-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    border-radius: 4px;
    padding: 6px 10px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    background: var(--c--globals--colors--brand-500, #4f46e5);
    color: #fff;
  }
  .loop-table__panel-button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .loop-table__panel-button.is-secondary {
    background: var(--lt-hover);
    color: inherit;
  }
  .loop-table__emoji {
    margin: -8px;
  }
  .loop-table__emoji > div {
    position: static !important;
  }
  .loop-table__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 12px;
    margin: 1px 4px 1px 0;
    line-height: 20px;
    white-space: nowrap;
  }
  .loop-table__vote {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--lt-border);
    border-radius: 999px;
    background: transparent;
    padding: 1px 10px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
  }
  .loop-table__vote.is-voted {
    border-color: var(--lt-accent);
    color: var(--lt-accent);
    font-weight: 600;
  }
  .loop-table__summary td {
    background: var(--lt-hover);
    color: var(--lt-muted);
    font-size: 12px;
    border-bottom: none;
  }
  .loop-table__summary-button {
    width: 100%;
    min-height: 32px;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: right;
    padding: 6px 8px;
    cursor: pointer;
  }
  .loop-table__summary-button.is-left {
    text-align: left;
  }
  .loop-table__summary-button:hover {
    color: var(--lt-accent);
  }
  .loop-table tr.is-drag-source td,
  .loop-table th.is-drag-source,
  .loop-table td.is-drag-source {
    background: var(--lt-hover) !important;
    opacity: 0.55;
  }
  .loop-table tr.is-drop-before td {
    box-shadow: inset 0 3px 0 0 var(--lt-accent);
  }
  .loop-table tr.is-drop-after td {
    box-shadow: inset 0 -3px 0 0 var(--lt-accent);
  }
  .loop-table th.is-drop-before,
  .loop-table td.is-drop-before {
    box-shadow: inset 3px 0 0 0 var(--lt-accent);
  }
  .loop-table th.is-drop-after,
  .loop-table td.is-drop-after {
    box-shadow: inset -3px 0 0 0 var(--lt-accent);
  }
  /* A dragged row or column, following the pointer. Its own width: the
     drag layer is only as wide as the handle that was grabbed */
  .loop-table__drag-ghost {
    display: block;
    width: max-content;
    max-width: 900px;
    overflow: hidden;
    border: 1px solid var(--lt-accent);
    border-radius: 4px;
    background: var(--c--contextuals--background--surface--primary, white);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
    opacity: 0.92;
    pointer-events: none;
    cursor: grabbing;
  }
  .loop-table__drag-ghost .loop-table__grid {
    min-width: 0;
    width: auto;
  }
  .loop-table__drag-ghost tr:last-child td {
    border-bottom: none;
  }
  .loop-table__drag-ghost-more {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--lt-muted);
    border-top: 1px solid var(--lt-border);
  }
  .loop-table__drag-preview {
    background: var(--c--contextuals--background--surface--primary, white);
    border: 1px solid var(--lt-accent);
    border-radius: 4px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    padding: 6px 10px;
    font-size: 13px;
    max-width: 360px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .loop-table__popover {
    position: fixed;
    z-index: 2000;
    font-size: 14px;
    width: max-content;
    max-width: min(380px, calc(100vw - 16px));
    background: var(--c--contextuals--background--surface--primary, white);
    border: 1px solid var(--lt-border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    padding: 8px;
    min-width: 240px;
  }
  .loop-table__popover-item {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    border: none;
    background: transparent;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    font-size: 13px;
  }
  .loop-table__popover-item:hover,
  .loop-table__popover-item:focus-visible {
    background: var(--lt-hover);
    outline: none;
  }
  .loop-table__popover input,
  .loop-table__popover select {
    font: inherit;
    font-size: 13px;
    padding: 4px 6px;
    border: 1px solid var(--lt-border);
    border-radius: 4px;
    background: transparent;
  }
  .loop-table__filter-rule {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  .loop-table__popover-heading {
    padding: 8px 8px 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--lt-muted);
  }
  .loop-table__muted {
    color: var(--lt-muted);
    font-size: 12px;
  }
  .loop-table__missing {
    padding: 12px;
    border: 1px dashed var(--lt-border);
    border-radius: 6px;
    color: var(--lt-muted);
  }
`;
