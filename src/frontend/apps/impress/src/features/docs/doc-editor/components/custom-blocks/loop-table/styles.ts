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
  .loop-table__toolbar {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-bottom: 6px;
    flex-wrap: wrap;
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
    vertical-align: top;
    position: relative;
    background: var(--c--contextuals--background--surface--primary, white);
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
  .loop-table__rownum {
    width: 44px;
    min-width: 44px;
    text-align: center !important;
    color: var(--lt-muted);
    font-size: 12px;
  }
  .loop-table__rownum-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 36px;
    gap: 2px;
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
  tr:hover .loop-table__handle,
  th:hover .loop-table__handle,
  .loop-table__handle:focus-visible {
    visibility: visible;
  }
  tr:hover .loop-table__rownum-number {
    display: none;
  }
  .loop-table__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
    height: 36px;
    cursor: pointer;
  }
  .loop-table__header:hover {
    background: var(--lt-hover);
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
  .loop-table__new-row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--lt-muted);
    padding: 8px 12px;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .loop-table__new-row:hover {
    background: var(--lt-hover);
  }
  .loop-table__add-column {
    width: 40px;
    min-width: 40px;
  }
  .loop-table__add-column button {
    width: 100%;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--lt-muted);
    cursor: pointer;
    font-size: 18px;
  }
  .loop-table__add-column button:hover {
    background: var(--lt-hover);
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
  .loop-table th.is-drop-before,
  .loop-table td.is-drop-before {
    box-shadow: inset 3px 0 0 0 var(--lt-accent);
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
