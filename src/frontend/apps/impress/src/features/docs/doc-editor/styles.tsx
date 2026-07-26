import { createGlobalStyle } from 'styled-components';

export const DocsEditorStyle = createGlobalStyle`
  .bn-container {
    height: 100%;
  }
  /**
  * Token Blocknote
  */
  .bn-root[data-color-scheme] {
    --bn-colors-editor-text: var(
      --c--contextuals--content--semantic--neutral--primary
    );
    --bn-colors-side-menu: var(
      --c--contextuals--content--semantic--neutral--tertiary
    );
  }
  .bn-root .mantine-Chip-label {
    --chip-color: var(--c--contextuals--content--semantic--brand--tertiary);
    --mantine-primary-color-filled-hover: var(--c--contextuals--content--semantic--brand--tertiary);
  }

  .bn-root {
    .bn-editor {
      height: 100%;
    }

    .mantine-Menu-itemLabel,
    .mantine-Button-label {
      font-family: var(--c--components--button--font-family);
    }

    /**
    * Ensure long placeholder text is truncated with ellipsis
    */
    .bn-block-content[data-is-empty-and-focused][data-content-type='paragraph']
      .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      width: inherit;
      height: inherit;
    }
    .bn-block-content[data-is-empty-and-focused][data-content-type='paragraph']
      .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child) {
      position: relative;
    }

    /**
    * Ensure images with unsafe URLs are not interactive
    */
    img.bn-visual-media[src*='-unsafe'] {
      pointer-events: none;
    }

    /**
    * Collaboration cursor styles
    */
    .collaboration-cursor-custom__base {
      position: relative;
    }
    .collaboration-cursor-custom__caret {
      position: absolute;
      height: 100%;
      width: 2px;
      bottom: 4%;
      left: -1px;
    }
    .collaboration-cursor-custom__label {
      color: #0d0d0d;
      font-size: 12px;
      font-weight: 600;
      -webkit-user-select: none;
      -moz-user-select: none;
      user-select: none;
      position: absolute;
      top: -17px;
      left: 0px;
      padding: 0px 6px;
      border-radius: 0px;
      white-space: nowrap;
      transition: clip-path 0.3s ease-in-out;
      border-radius: 4px 4px 4px 0;
      box-shadow: inset -2px 2px 6px #ffffff00;
      clip-path: polygon(0 85%, 4% 85%, 4% 100%, 0% 100%);
    }
    .collaboration-cursor-custom__base[data-active]
      .collaboration-cursor-custom__label {
      pointer-events: none;
      box-shadow: inset -2px 2px 6px #ffffff88;
      clip-path: polygon(0 0, 100% 0%, 100% 100%, 0% 100%);
    }

    /**
    * Side menu
    */
    .bn-side-menu .mantine-UnstyledButton-root svg {
      color: var(
        --c--contextuals--content--semantic--neutral--tertiary
      ) !important;
    }

    /**
    * Callout, Paragraph and Heading blocks
    */
    .bn-block {
      border-radius: var(--c--globals--spacings--3xs);
    }
    .bn-block-outer {
      border-radius: var(--c--globals--spacings--3xs);
    }
    .bn-block > .bn-block-content[data-background-color] {
      padding: var(--c--globals--spacings--3xs) var(--c--globals--spacings--3xs);
      border-radius: var(--c--globals--spacings--3xs);
    }
    .bn-block-content[data-content-type='checkListItem'][data-checked='true']
      .bn-inline-content {
      text-decoration: none;
    }
    a {
      color: var(--c--globals--colors--gray-600);
      cursor: pointer;
    }
    .bn-block-group
      .bn-block-group
      .bn-block-outer:not([data-prev-depth-changed]):before {
      border-left: none;
    }

    .bn-toolbar {
      max-width: 95vw;
    }

    /**
    * Quotes
    */
    blockquote {
      border-left: 4px solid var(--c--globals--colors--gray-300);
      font-style: italic;
    }

    /**
    * AI
    */
    ins,
    [data-type='modification'] {
      background: var(--c--globals--colors--brand-100);
      border-bottom: 2px solid var(--c--globals--colors--brand-300);
      color: var(--c--globals--colors--brand-700);
    }

    /**
    * Divider
    */
    .bn-block-content[data-content-type='divider'] {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      padding: 0;
    }
    .bn-block-content[data-content-type='divider'] hr {
      flex: 1 1 100%;
      width: 100%;
      height: 1px;
      margin: 0;
      border: 0;
      border-radius: 11px;
      background: var(--c--contextuals--border--surface--primary);
    }
    .bn-block-content[data-content-type='divider'].ProseMirror-selectednode hr {
      height: 9.5px;
      outline: 0 !important;
      box-shadow: none;
      border: 4px solid
        var(--c--contextuals--border--semantic--brand--tertiary);
      background: var(--c--contextuals--border--semantic--brand--secondary);
    }
    .bn-side-menu[data-block-type='divider'] {
      height: 28px;
    }

    /**
    * Checklist items
    */
    .bn-block-content[data-content-type='checkListItem'] > div > input {
      appearance: none;
      width: 20px;
      height: 20px;
      border: 2px solid
        var(--c--contextuals--content--semantic--neutral--tertiary);
      border-radius: 4px;
      cursor: pointer;
      position: relative;
      align-self: center;
      margin-top: 2px;
    }
    .bn-block-content[data-content-type='checkListItem'] > div > input:checked {
      background-color: var(--c--contextuals--content--semantic--brand--tertiary);
      border-color: var(--c--contextuals--content--semantic--brand--tertiary);
    }
    .bn-block-content[data-content-type='checkListItem']
      > div
      > input:checked::after {
      content: 'check';
      font-family: 'Material Symbols Outlined Variable', sans-serif;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: var(--c--contextuals--content--semantic--overlay--primary);
      font-size: 18px;
    }

    /**
      * Headings
      * Ensure consistent spacing between headings and paragraphs
    */
    [data-content-type='heading'] {
      --level: 1.875rem;
      padding-top: 3px;
      &[data-level='2'] {
        --level: 1.5rem;
      }
      &[data-level='3'] {
        --level: 1.25rem;
      }
      &[data-level='4'] {
        --level: 1.125rem;
      }
      &[data-level='5'] {
        --level: 1rem;
      }
      &[data-level='6'] {
        --level: 0.875rem;
      }
    }
    .bn-side-menu[data-block-type='heading'][data-level='1'] {
      height: 54px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='2'] {
      height: 43px;
    }
    .bn-side-menu[data-block-type='heading'][data-level='3'] {
      height: 35px;
    }
    & .bn-default-styles h1 {
      font-size: 1.875rem;
    }
    & .bn-default-styles h2 {
      font-size: 1.5rem;
    }
    & .bn-default-styles h3 {
      font-size: 1.25rem;
    }
    & .bn-default-styles h4 {
      font-size: 1.125rem;
    }
    & .bn-default-styles h5 {
      font-size: 1rem;
    }
    & .bn-default-styles h6 {
      font-size: 0.875rem;
    }
    & .bn-block-outer:not(:first-child):not(:has([data-content-type="toggleListItem"])) {
      &:has(h1) {
        margin-top: 32px;
      }
      &:has(h2) {
        margin-top: 24px;
      }
      &:has(h3) {
        margin-top: 16px;
      }
    }

    & .bn-inline-content code {
      background-color: gainsboro;
      padding: 2px;
      border-radius: 4px;
    }

    /**
    * Tables
    * Loop/Notion-style card look: rounded outer border, muted header row,
    * hairline internal grid and a hover highlight instead of the default
    * harsh black grid lines.
    */
    .bn-editor [data-content-type='table'] table {
      border-collapse: separate;
      border-spacing: 0;
      border: 1px solid var(--c--contextuals--border--surface--primary);
      border-radius: var(--c--globals--spacings--xs);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    .bn-editor [data-content-type='table'] th,
    .bn-editor [data-content-type='table'] td {
      border: none;
      border-right: 1px solid var(--c--contextuals--border--surface--primary);
      border-bottom: 1px solid var(--c--contextuals--border--surface--primary);
      padding: 10px 16px;
      transition: background-color 0.15s ease;
    }
    .bn-editor [data-content-type='table'] th:last-child,
    .bn-editor [data-content-type='table'] td:last-child {
      border-right: none;
    }
    .bn-editor [data-content-type='table'] tr:last-child th,
    .bn-editor [data-content-type='table'] tr:last-child td {
      border-bottom: none;
    }
    .bn-editor [data-content-type='table'] th {
      background-color: var(
        --c--contextuals--background--semantic--neutral--tertiary
      );
      color: var(--c--contextuals--content--semantic--neutral--secondary);
      font-weight: 600;
      font-size: 0.8125em;
      letter-spacing: 0.01em;
    }
    .bn-editor [data-content-type='table'] tr:hover > td {
      background-color: var(
        --c--contextuals--background--semantic--neutral--secondary-hover
      );
    }
    .bn-editor [data-content-type='table'] .selectedCell:after {
      background: var(--c--contextuals--background--semantic--brand--tertiary);
      opacity: 0.6;
    }

    /**
    * Row/column reordering: make the dragged row/column and the drop
    * target clearly distinguishable from one another and from a plain
    * hover/selection.
    */
    .bn-editor [data-content-type='table'] tr.bn-table-drag-source-row > td,
    .bn-editor [data-content-type='table'] tr.bn-table-drag-source-row > th,
    .bn-editor [data-content-type='table'] td.bn-table-drag-source-col,
    .bn-editor [data-content-type='table'] th.bn-table-drag-source-col {
      background-color: var(
        --c--contextuals--background--semantic--brand--tertiary
      );
      outline: 1.5px dashed
        var(--c--contextuals--border--semantic--brand--tertiary);
      outline-offset: -1.5px;
    }
    .bn-editor [data-content-type='table'] .bn-table-drop-cursor {
      background-color: var(
        --c--contextuals--background--semantic--brand--primary
      );
      border-radius: 2px;
    }

    @media screen and (width <= 768px) {
      & .bn-editor {
        padding-right: 36px;
      }
    }

    @media screen and (width <= 560px) {
      .--docs--doc-readonly & .bn-editor {
        padding-left: 10px;
      }
      & .bn-editor {
        padding-right: 10px;
      }
      .bn-side-menu[data-block-type='heading'][data-level='1'] {
        height: 46px;
      }
      .bn-side-menu[data-block-type='heading'][data-level='2'] {
        height: 40px;
      }
      .bn-side-menu[data-block-type='heading'][data-level='3'] {
        height: 40px;
      }
      [data-content-type='heading'] {
        --level: 1.6rem;
        &[data-level='2'] {
          --level: 1.35rem;
        }
        &[data-level='3'] {
          --level: 1.2rem;
        }
        &[data-level='4'] {
          --level: 1.125rem;
        }
        &[data-level='5'] {
          --level: 1rem;
        }
        &[data-level='6'] {
          --level: 0.875rem;
        }
      }
      & .bn-editor h1 {
        font-size: 1.6rem;
      }
      .bn-block-content[data-is-empty-and-focused][data-content-type='paragraph']
        .bn-inline-content:has(> .ProseMirror-trailingBreak:only-child)::before {
        font-size: 14px;
      }
    }
  }

  /**
  * Table row/column drag handles and add-row/add-column buttons.
  * Kept outside the .bn-root nesting above and scoped to .bn-mantine,
  * matching the selectors BlockNote itself uses for these elements.
  */
  .bn-mantine .bn-table-handle,
  .bn-mantine .bn-table-cell-handle {
    border-radius: var(--c--globals--spacings--4xs);
  }
  .bn-mantine .bn-table-handle:hover,
  .bn-mantine .bn-table-handle-dragging,
  .bn-mantine .bn-table-cell-handle:hover,
  .bn-mantine .bn-extend-button:hover,
  .bn-mantine .bn-extend-button-editing {
    background-color: var(
      --c--contextuals--background--semantic--brand--tertiary-hover
    );
    color: var(--c--contextuals--content--semantic--brand--tertiary);
  }
`;
