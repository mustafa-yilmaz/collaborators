# Collaborators — Feature Spec

> **Status:** living draft v0.1 (2026-10-19). Expect changes after the first demo.
> **Product:** Collaborators — https://collaborators.community
> **Base:** fork of [La Suite Docs](https://github.com/suitenumerique/docs) (MIT), cloned at `0579a0ff` (2026-10-14, after v6.0.1). The original repo is the `upstream` git remote.

Collaborators combines the best parts of Notion, Atlassian Confluence, Microsoft Loop, La Suite Docs and Docmost into one platform. This spec lists what we are building (**Must-haves**), how it maps onto the Docs codebase, and the order we build it in.

Legend for "Docs today": ✅ already there · 🟡 partly there · ❌ to build.

---

## 1. Vocabulary and structure

| Term | Meaning |
|---|---|
| **Collaborators** | The platform itself, the roof over everything. Run by **Platform admins**. Its logo is the text wordmark **CO✍️✍️ABORATORS**, in bold italic capitals (no logo image), so it works the same in the app and in emails; page titles and screen readers use the plain name "Collaborators". |
| **Collaborator** | A person with an account (we don't say "user" in the UI). **Guest collaborators** are outsiders invited into a single space. |
| **Workspace** | An organisation-level area (a company, university, community). Has its own members, admins and groups. Address: `<slug>.collaborators.community`. |
| **Space** | A team or topic area inside a workspace, holding a tree of pages. |
| **Shared space** | A space owned by one workspace (its **home**) and linked into others. |
| **Independent space / page** | A space or page owned by a collaborator instead of a workspace. |
| **Page** | A document: blocks, sub-pages, Loop tables. |
| **Group** | A set of collaborators managed by workspace admins: a **Team** (task based) or an **Organization** (company, institution). |

```
Collaborators  (collaborators.community)
├── Workspace "Acme"                     acme.collaborators.community
│   ├── Space "Engineering"  → pages
│   └── Space "Q4 Launch"    → pages     (shared with workspace "Partner Co")
├── Independent space "Mustafa's Research"   (owned by a collaborator)
│   └── pages
└── Independent page "Trip plan"             (no space, no workspace)
```

### Ownership rules

- Every space and every page has exactly **one owner**: a workspace or a collaborator.
- A page belongs to at most one space; sub-pages follow their parent.
- **Moving:** an independent page can move into a space, and an independent space can move into a workspace or be linked into one as a Shared space. Moving content *out* of a workspace needs a workspace admin.
- **Shared spaces:** the home workspace controls the space's settings, deletion and which workspaces it is linked to. Linked workspaces show it with a "Shared from Acme" badge, and their own admins decide which of their groups can open it. Unlinking removes it from that workspace without deleting content.

### Roles

| Level | Roles |
|---|---|
| Platform | Platform admin · Collaborator |
| Workspace | Owner · Admin · Member · Guest |
| Space / page | Owner · Administrator · Editor · Commenter · Reader *(Docs' existing `RoleChoices`)* |

Space and page access can be granted to a collaborator or to a **group**.

---

## 2. Must-have features

| # | Feature | Docs today |
|---|---|---|
| F1 | Loop-style table, with @mentions and groups in cells | ❌ only simple BlockNote tables |
| F2 | Self sign-up through SSO only | ✅ phase 6 (see what is left below) |
| F3 | Lean dashboard each collaborator can customise | ✅ phase 4 |
| F4 | @mentions with notifications in pages, comments and table cells | 🟡 user mentions + email exist; inbox, groups, table cells to build |
| F5 | Groups managed by workspace admins (Teams, Organizations) | 🟡 a `team` access hook exists but is empty |
| F6 | Platform → Workspace → Space → Page, with Shared spaces | ❌ Docs has only a tree of documents |
| F7 | Independent spaces and pages | 🟡 every Docs document is independent today; independent *spaces* to build |
| F8 | Public sharing: pages to the web, spaces as public wikis | ✅ phase 5 (see what is left below) |

### F1 — Loop-style table

See **section 3**: it is the largest single piece of work.

### F2 — SSO-only self sign-up

**Requirements**
- Sign up and sign in only through: **Google** (personal + Google Workspace), **Microsoft** (personal + work/school), **Apple**, **LinkedIn**, **X**. More providers can be added by configuration.
- **No email-invitation sign-up.** Anyone can create an account by signing in. Sharing only finds collaborators who already have an account; to bring someone new, you send them a join link.
- **Account linking:** signing in with a second provider whose *verified* email matches an existing account links to that account after confirmation. Settings → "Sign-in methods" lists, adds and removes providers (at least one must remain).
- **Provider quirks to handle:**
  - Microsoft: use the `common` endpoint so both personal and work accounts work; the `tid` claim identifies the company tenant.
  - Google: the `hd` claim identifies a Google Workspace domain.
  - Apple: may give a private relay email and sends the name only on the first sign-in.
  - X: may not return an email; ask the collaborator for one and verify it.
- **Workspace joining:** a workspace can be joined by (a) a join link, (b) admin approval of a request, or (c) automatically by **verified domain** (`@acme.com`, or Microsoft tenant / Google Workspace domain), which also adds the person to that workspace's matching Organization group (F5).

**Docs today**
- Login is OIDC via `mozilla-django-oidc`, with Keycloak in development; users are created on first login (`OIDC_CREATE_USER`).
- An email `Invitation` model and endpoint exist (`InvitationViewset`).

**Work**
- Configure an identity broker in front of Django with the five providers. Keycloak is already in the dev stack; **verify** its Apple and X support before committing, otherwise use Zitadel or Authentik.
- Branded sign-in page with provider buttons.
- Turn off invitation-based sign-up in the UI and API; keep the model only until migration cleanup.
- Account linking and "Sign-in methods" settings.
- Store provider, tenant id and domain claims on the collaborator for F5 auto-join.

**Built in phase 6:**
- **Sign-in page** `/signin`: one *Continue with …* button per provider set up (Google, Microsoft, Apple, LinkedIn, X), each going straight to it; a test-account button in development only.
- **Providers:** the setup script adds LinkedIn and X (Keycloak's own providers) and Apple (with the Keycloak Apple extension). Each needs its app made at the provider (see `sso-setup.md`).
- **Account linking:** Keycloak's first sign-in flow links a second provider giving the same email, after confirmation (sign in with the first method, or a link by email). Google, Apple and LinkedIn emails count as verified; Microsoft work accounts and X don't. *Sign-in methods* in the account menu opens Keycloak's linked-accounts page.
- **Joining a workspace:**
  - **Join link**, made, renewed or turned off by admins; `/join/<link>` asks to sign in, then joins.
  - **Email domain:** a verified email at the domain joins on sign-in, also into an organisation group if one is chosen. An admin can only add the domain of their own verified email; public domains (Gmail, Outlook…) are refused.
- **Email invitations** to documents are turned off; documents are shared with people who have an account.

**Still to do:**
- Asking X users for an email and verifying it ourselves (Keycloak asks for one, unverified).
- Joining by Google Workspace domain (`hd`) or Microsoft tenant (`tid`) claims.
- Join requests approved by admins.
- A sign-in-methods page inside Collaborators, rather than Keycloak's.

### F3 — Lean, customisable dashboard

**Requirements**
- The landing screen after sign-in. Lean by default: a search box and **three cards**: *Recent pages*, *Mentions & notifications*, *Assigned to me*.
- Optional cards a collaborator can add: *Favorites*, *My spaces*, *My workspaces*, *Independent pages*, *Shared with me*.
- Each collaborator can **collapse**, **hide**, **show** and **reorder** cards (drag and drop, plus keyboard), and **Reset to default**.
- Layout is saved on the server per collaborator, so it follows them across devices.
- Works on phone widths (cards stack in one column).

**Docs today:** ❌ the home page lists documents.

**Work:** dashboard page, card registry, per-user layout preference (API + model), "Assigned to me" query over Loop tables (F1).

### F4 — @mentions and notifications

**Requirements**
- `@` suggests **collaborators and groups** in page text, comments and **Loop table cells**.
- Typing `@` alone lists, with nothing typed: the people one works with, all groups and all pages one can read. Typing narrows the list.
  - **People** = members of one's workspaces + people one shares pages with. Never every account on the platform (user's decision).
  - Anyone else is found by the platform-wide search after 3 letters.
  - **Groups** = every group of every workspace one belongs to.
- Assigning a collaborator or group in a table's **Person** column also notifies them.
- **Notification inbox** (bell icon) with unread count, mark read / all read, and filters; each item links to the exact block, comment or **table cell** and highlights it.
- **Email** per collaborator preference: right away, or off. (Daily digests were dropped.)
- Only *newly added* mentions notify; re-editing a page doesn't notify again.
- If the person can't see the page, the writer is asked whether to share it with them.
- **Group mentions:** members are resolved when the notification is sent. Mentioning more than 20 people asks "Notify N people?" first.
- Collaborators can mute a page, a space or a group mention.
- On public pages (F8), mentions show the display name only.

**Docs today**
- `Mention` model (document, block `anchor_id`, optional comment thread, mentioned user) and `POST /documents/{id}/mention/`, which emails the user with a cooldown so repeated mentions don't spam.
- No in-app inbox, no group mentions, no table-cell anchors.

**Work**
- `Notification` model and inbox UI (bell, list, read state, preferences).
- Extend `Mention`: optional `mentioned_group`; anchor that can point at a **table cell** (table id + row id + column id).
- Fan-out of group mentions to members; "Notify N people?" confirmation.
- Later hardening: detect added and removed mentions on the server when the collaboration server reports new content (`content-updated`), rather than trusting the client alone.

### F5 — Groups

**Requirements**
- Workspace admins create, rename and delete groups; add and remove members; optionally appoint **group managers** who can manage membership.
- Two kinds: **Team** (task based, e.g. "Q4 Launch") and **Organization** (company or institution, e.g. "Acme").
- Organizations can fill automatically from verified domains or Microsoft tenants at sign-in (F2).
- Groups work everywhere a person works: @mentions (pages, comments, **table cells**), Person columns in Loop tables, sharing and permissions, and filters ("Assigned to me" includes rows assigned to my groups).
- A group chip shows its name; hovering lists its current members.
- In a Shared space, each linked workspace grants access to its own groups.

**Docs today:** `DocumentAccess` already accepts a `team` instead of a user, and `User.teams` is a hook that currently returns an empty list.

**Work:** `Group` and `GroupMembership` models scoped to a workspace; make `User.teams` return the collaborator's group ids so existing team-based access works unchanged; admin UI; group search in the mention menu and Person columns.

### F6 — Workspaces, spaces and Shared spaces

**Requirements:** as described in section 1, with a workspace switcher, a space list in the sidebar, workspace settings (members, groups, domains, join link, publishing policy) and space settings (members, groups, linked workspaces).

**Docs today:** ❌ documents form one tree per root document (`django-treebeard`), with no workspace or space layer.

**Work:** `Workspace`, `WorkspaceMembership`, `Space`, `SpaceWorkspaceLink` (with one *home* link). A space owns a set of root documents, so Docs' existing tree, sharing and history keep working inside it. Subdomain routing per workspace.

### F7 — Independent spaces and pages

**Requirements**
- A collaborator can create spaces and pages that belong to no workspace.
- They are shared person by person (groups become available once the content joins a workspace).
- A "My spaces & pages" section in the sidebar.
- Moving rules as in section 1.

**Docs today:** ✅ for pages: every Docs document is already owned by people, not a workspace.

**Work:** independent spaces (a `Space` whose owner is a collaborator) and the move/link flows.

### F8 — Public sharing and public wikis

**Requirements**
- **Publish a page to the web:** public read-only link, optionally including sub-pages, with a switch for search engine indexing.
- **Publish a space as a wiki:** public read-only site with a page-tree sidebar, wiki-wide search, its own logo and colours, and clean addresses (`collaborators.community/wiki/<slug>` or `<workspace>.collaborators.community/<slug>`). Custom domains later.
- Pages can be marked **Keep private** to leave them out of a published wiki.
- **Privacy:** mentions show display names only; links to private pages render as "Private page"; Loop tables publish read-only with names only in Person cells.
- Workspace admins choose who may publish; an audit log records who published what and when.
- Published content updates live; "publish a fixed version" may come later.

**Docs today:** 🟡 a document's link reach can be `public` with a reader role, and access passes down to sub-pages. No wiki mode, slugs, indexing control or redaction.

**Work:** wiki renderer and routes, slugs, `noindex` control, Keep private flag, redaction of mentions and private links for anonymous readers, publishing policy and audit log.

**Built in phase 5:**
- *Publish to the web* in the share dialog:
  - **Spaces:** *Publish as wiki*, with an address, one of six accent colours and a search-engine switch. Publishing makes the space public and read-only for everyone not invited.
  - **Public pages:** a *Let search engines find this page* switch.
  - **Sub-pages:** *Keep private*. A page kept private inherits no link access (public, or any signed-in collaborator) from the pages above it, so it and its sub-pages leave public links and wikis. Invited people keep their access.
- **Wiki reader** at `/wiki/<slug>` and `/wiki/<slug>/<page>`, for anyone:
  - the page tree and a title search on the side;
  - the wiki's colour, and an *Edit* button for its editors;
  - links to its own pages stay in the wiki;
  - links to pages the reader can't open read "Private page".
- **Search engines:** pages are `noindex` unless published with indexing allowed.
- **Workspace settings → Publishing:**
  - *Who can publish*: space owners and administrators, or workspace administrators only.
  - The **publishing log**: page published or unpublished, and wiki published, updated or unpublished.

**Still to do:**
- Full-text wiki search (titles only today).
- An image logo for a wiki (it shows the space title).
- `<workspace>.collaborators.community` addresses and custom domains.
- Publishing a fixed version.

---

## 3. Loop-style table (F1)

The goal is Microsoft Loop's table with all its features, plus what Collaborators needs on top (groups, notifications) and fixes for gaps Loop users often complain about.

**Sources.** Microsoft has no single reference page for Loop tables. Behaviour below comes from Microsoft 365 Insider posts, Microsoft Support, and hands-on reviews (research done 2026-10-19; source links in the appendix).

**Tags used in this section:**
- **Origin:** **L** = Loop does this (documented) · **L?** = Loop behaviour not documented; to verify hands-on in Loop (section 3.7) · **C** = Collaborators addition.
- **Phase:** **v1** = first table demo (delivery phase 2) · **v2** = next iteration · **Later**.

### 3.1 Inserting and structure

| # | Behaviour | Origin | Phase |
|---|---|---|---|
| T1 | `/table` inserts a table into a page; it starts as 2 columns × 2 rows | L | v1 |
| T2 | A built-in, non-removable **row-number column** on the left. It holds the row's drag handle and the "open details" icon | L | v1 |
| T3 | A header row with column names; header text is plain (no rich formatting) | L | v1 |
| T4 | A **summary row** at the bottom (see T25) | L | v1 |
| T5 | The table can be widened into the page margins ("expand to margins") | L | v1 |
| T6 | Pasting cells from Excel or Google Sheets fills the table, adding rows and columns as needed | L | v1 |
| T7 | Import a CSV file into a new table | L? | v2 |
| T8 | Templates built on the same table: Task list, Voting table, Progress tracker, Kanban, Retrospective | L | Later |

### 3.2 Column types

| # | Type | Behaviour | Origin | Phase |
|---|---|---|---|---|
| T9 | **Text** (default) | Rich text: bold, italic, text and background colour, links. `/` inside a cell inserts inline elements (label, date, person, emoji, image) | L | v1 |
| T10 | **Number** | Right-aligned. **Formats** (plain, decimals, %, currency) | L / formats C | v1 |
| T11 | **Date** | Calendar picker; the year is hidden for dates in the current year | L | v1 |
| T12 | **Person** | Pick one or more **collaborators or groups**; assigning notifies them (F4). Group chips show members on hover | L / groups + notify C | v1 |
| T13 | **Label** | Coloured single-select chips from a **label group**. Built-in groups: Priority (Low/Medium/High) and Progress (Not started/In progress/Done); custom groups with editable names and colours | L | v1 |
| T14 | **Label (multi-select)** | Several labels in one cell. Loop can't do this; users ask for it | C | v2 |
| T15 | **Voting** | A `+` button and count; hover shows who voted | L | v1 |
| T16 | Reusable label groups across a workspace (Loop limits them to one page) | C | v2 |
| T17 | Checkbox, URL, Formula and Rollup columns. Loop has none of these | C | Later |

- **Change column type** from the header menu. Loop erases the column's contents when you do this. We **convert values where possible** (e.g. text "12" → number 12) and ask for confirmation before discarding anything. **C**, v1.

### 3.3 Column and row operations

| # | Behaviour | Origin | Phase |
|---|---|---|---|
| T18 | **Add a column:** hover over a column border and click the `+` at the top; also insert left/right from the header menu | L | v1 |
| T19 | **Header menu** (down-arrow on hover): rename (or double-click the header), change type, insert left/right, sort, filter, hide, delete | L | v1 |
| T20 | **Resize** a column by dragging its border | L | v1 |
| T21 | **Reorder columns** by dragging the six-dot handle above the header | L | v1 |
| T22 | **Add a row:** "New" at the bottom, the `+` between row numbers, or **Tab in the last cell** | L | v1 |
| T23 | **Reorder rows** by dragging the six-dot handle beside the row number | L | v1 |
| T24 | Row menu (right-click or handle): insert above/below, duplicate, delete, open details, comment | L / L? | v1 |
| T25 | **Summary row:** Number columns show Sum (default), Average, Count, Min or Max; Person columns show a count per person. Click the summary cell to change it | L | v1 |
| T26 | **Select several rows**, then delete, copy or drag them together | L (task lists) | v2 |
| T27 | **Row height** setting (compact / normal / tall), and text wrap per column | L? | v2 |
| T28 | **Hide columns** | L? | v1 |
| T29 | **Freeze** the first column(s) while scrolling sideways. Loop doesn't have this | C | v2 |
| T30 | Merged cells: **not supported** (Loop doesn't support them either; they break sorting and filtering) | — | — |

**Drag-and-drop feedback (T21, T23)**
- While dragging, the moving row or column is highlighted, a copy of its cells follows the cursor, and a drop line shows where it will land.
- This is the behaviour from your BlockNote PR [#2920](https://github.com/TypeCellOS/BlockNote/pull/2920), carried over to the Loop table.
- **C additions:** reordering also works by **keyboard** and on **touch screens**. BlockNote's own tables can't do either today.

### 3.4 Sort, filter, group and views

| # | Behaviour | Origin | Phase |
|---|---|---|---|
| T31 | **Toolbar** above the table: Filter, Sort, Switch view, Group by, Expand/Collapse | L | v1 |
| T32 | **Filter:** rules of column + condition + value, combined with AND. The icon shows how many rules are active. A row you edit stays visible until the filter is reapplied | L | v1 |
| T33 | Filter rules combined with **OR**, and rule groups | C | v2 |
| T34 | **Sort** by a column, ascending or descending | L | v1 |
| T35 | Sort by **several columns** | L? / C | v2 |
| T36 | Filters and sort are **saved with the table and shared** with everyone who can see the page | L | v1 |
| T37 | A personal "only for me" filter that doesn't change the table for others | C | v2 |
| T38 | **Board view** of the same data: cards grouped by a chosen Label or Person column; drag cards between columns; duplicate cards. Needs at least one Text and one Label column. Filters carry over between Table and Board | L | v2 |
| T39 | **Group rows by a column** in Table view, with collapsible groups | C | v2 |
| T40 | "Assigned to me" filter, which includes rows assigned to my groups | C | v1 |

### 3.5 Cells, details and collaboration

| # | Behaviour | Origin | Phase |
|---|---|---|---|
| T41 | **@mentions in Text cells** of collaborators **and groups**. Mentioning notifies; the notification opens the page and highlights the cell (F4) | L / groups C | v1 |
| T42 | Page links in cells (`Ctrl/⌘+K`, and `[[` to link to another page) | L / `[[` C | v1 |
| T43 | **Real-time co-editing** with coloured cursors and presence avatars | L | v1 (comes from Docs) |
| T44 | **Comments on a cell:** right-click → New comment, or `Ctrl/⌘+Shift+F2`. A small icon marks commented cells; threaded replies; you can edit or delete only your own comments | L | v2 |
| T45 | **Row details panel:** open a row from the number column (or right-click → View details) to edit all its fields in a side panel and add free-form notes below them | L | v2 |
| T46 | Row details as a full page, next/previous row navigation, and a link to a single row | L? | Later |
| T47 | **Rules:** "when this column changes or has this value, then notify…", with in-app and email notifications (no external automation service needed) | L | Later |
| T48 | Page version history includes table changes (Docs' history already covers the whole document) | L | v1 |

### 3.6 Keyboard, mobile, accessibility, export

| # | Behaviour | Origin | Phase |
|---|---|---|---|
| T49 | **Keyboard:** arrow keys move between cells; Enter edits; Esc leaves the cell; Tab and Shift+Tab move along a row; Tab in the last cell adds a row; `/` and `@` work inside cells; `Ctrl/⌘+Z` and `Ctrl/⌘+Y` undo and redo | L / L? | v1 |
| T50 | Selecting ranges with Shift+arrows, then copy, paste or clear them | C | v2 |
| T51 | Screen readers announce cells, headers and column types | L | v1 |
| T52 | **Touch:** tap to edit; long-press handles to drag; tables scroll sideways on phones | L? / C | v2 |
| T53 | **Export** a table to Excel (.xlsx) and CSV, mapping column types to the nearest Excel format | L / CSV C | v2 |
| T54 | Tables appear correctly in page PDF/DOCX export and in search results | C | v1 |
| T55 | Tables render read-only on public pages and wikis (F8), with names only in Person cells | C | v1 |
| T56 | Smooth with **1,000+ rows** (only visible rows are drawn) | C | v1 |
| T57 | **Background colour** and **text alignment** (horizontal and vertical) for a whole column (its "⌄" menu) or row (its "⋮" menu) | Collaborators | ✅ built |
| T58 | The same two for a **single cell** (format button on the selected cell, or right-click) | Collaborators | ✅ built |
| T59 | **Corner cell menu**: show or hide the numbers column; colour and alignment of the header row and of the numbers column | Collaborators | ✅ built |

### 3.7 To verify hands-on in Microsoft Loop

Loop's public documentation doesn't cover the following. Before building them, we should check them in a real Loop workspace, using your Microsoft account in the built-in browser, and record the exact behaviour here.

- **Formats and editing:** number formats, text wrap, row height in plain tables, insert row above/below.
- **Sharing and navigation:** whether sort is shared or per person, cell-to-cell keyboard keys.
- **Feel and limits:** drag-and-drop visuals (spacing, colours), touch gestures, row and column limits.
- **Features:** column hide and freeze, CSV import.

### 3.8 How we'll build it

- **A custom BlockNote block.** The table is a custom block in the editor. The block stores only a `tableId`. The table's data (columns, row order, cells, label groups, filters, sort, summaries) lives in the **same shared document** as the page, in its own part keyed by `tableId`. This gives tables real-time sync, offline support and version history for free.
  - Text cells hold rich text, so @mentions and links work inside them.
- **Grid and drag-and-drop libraries.** The grid is drawn with TanStack Table (sorting, filtering, grouping) and TanStack Virtual (large tables). Reordering uses dnd-kit, which supports keyboard and touch dragging. The visual feedback follows PR #2920.
- **Mentions point at cells.** A cell mention is a `Mention` whose anchor is *table + row + column*. Opening the notification scrolls to that cell and highlights it.
- **Spike first (start of phase 2).** Before building the full table, confirm three things:
  1. Docs' search indexing can read data stored outside the page's normal blocks.
  2. So can PDF/DOCX export and version history.
  3. Copying, duplicating and pasting a table copies its data.

  If any of these fail, the fallback is to store the table inside the block itself.
- **Simple tables stay.** BlockNote's own simple table stays available for plain layout tables. We apply your PR #2920 to it as a local patch until BlockNote merges it (or #2963).

---

## 4. Delivery plan

Each phase ends with something you can click through. Requirements may change after each one.

**Status (2026-10-19):** phases 0, 1, 2 (Loop table v1), 3 (mentions and notifications), 4 (the dashboard), 5 (public pages and wikis) and 6 (sign-in providers, account linking, joining) are built, on branches `collaborators/phase-0` to `-phase-6`.

Moved out of the table v1:
- **Table v2 (built):** rich formatting in Text cells (T9), "expand to margins" (T5), drawing only the visible rows of very large tables (T56, from 150 rows).
- **Done in phase 3:** @mentions inside Text cells (T41).

| Phase | Delivers | Features |
|---|---|---|
| 0 | Fork runs locally under the Collaborators name; Google and Microsoft sign-in | F2 (part) |
| 1 | Workspaces, spaces, groups; independent spaces | F5, F6, F7 |
| 2 | **Loop table v1**: column types, add/reorder/resize, sort, filter, Person column with people and groups | F1 (core) |
| 3 | Notification inbox; mentions of people and groups in pages, comments and table cells | F4, F1 (mentions) |
| 4 | Lean customisable dashboard | F3 |
| 5 | Public pages and public wikis | F8 |
| 6 | Remaining sign-in providers (Apple, LinkedIn, X), account linking, domain auto-join | F2 |

---

### To do next, in order

Done: the Loop table tweaks, and Loop table v2 (T9, T5, T56).

1. Wikis: full-text search (titles only today), an image logo, `<workspace>.collaborators.community` addresses and custom domains, publishing a fixed version (F8).
2. Setting up the sign-in providers for real: the apps at Google, Microsoft, Apple, LinkedIn, X (and any other), the Apple extension, production addresses, and asking X users for a verified email (F2). Until then, sign-in works locally with the test accounts.
3. A sign-in-methods page inside Collaborators, instead of Keycloak's (F2).
4. Joining: join requests approved by admins; joining by Google Workspace domain or Microsoft organisation (F2).

## 5. Open questions

1. **Identity broker:** Keycloak (already in the dev stack) or Zitadel / Authentik? Depends on Apple and X support.
2. **Hosting:** where collaborators.community will run (Docs ships Docker Compose and Kubernetes/Helm setups).
3. **GitHub:** create a public or private GitHub repository for the fork, and under which account?
4. **Editor extras under GPL:** build with `PUBLISH_AS_MIT=true` (drops PDF export and other BlockNote XL features), or accept GPL for those parts?
5. **Group managers:** needed in v1, or are workspace admins enough?
6. **Guest collaborators:** can a guest belong to a group?

---

## 6. Later (not Must-have yet)

Candidates from the five source products, to revisit after the demo: database views beyond tables (board, calendar, timeline), page templates, page verification and ownership (Confluence), page analytics, AI assistance, whiteboards and diagrams (Docmost: draw.io, Excalidraw, Mermaid), Loop-style portable components embedded in other apps, offline-first improvements, custom domains for public wikis.

---

## Appendix — Loop table sources (checked 2026-10-19)

- Microsoft 365 Insider / Tech Community:
  - [Filters](https://techcommunity.microsoft.com/t5/microsoft-365-insider-blog/introducing-filters-in-microsoft-loop-tables-and-boards/ba-p/4225058)
  - [Boards](https://techcommunity.microsoft.com/t5/microsoft-365-insider-blog/bringing-flexibility-and-customization-to-microsoft-loop-boards/ba-p/4226686)
  - [Board view](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/board-visualization-for-loop-tables/4223705)
  - [Comments](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/introducing-comments-in-loop-tables-and-boards/4226549)
  - [Detail view](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/add-context-to-microsoft-loop-tables-and-boards-with-the-detail-view/4224014)
  - [Task lists](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/improved-task-list-components-in-loop/4224232)
  - [Rules](https://techcommunity.microsoft.com/blog/microsoft365insiderblog/streamline-your-workflow-with-automation-in-microsoft-loop/4223906)
  - [Export to Excel](https://insider.microsoft365.com/en-us/blog/export-tables-to-excel-in-loop)
- Microsoft Support:
  - [Keyboard shortcuts for Loop](https://support.microsoft.com/en-us/office/keyboard-shortcuts-for-microsoft-loop-134d4c99-d28a-4d03-a5c9-0d3000011433)
  - [Loop components in Outlook](https://support.microsoft.com/en-us/office/use-loop-components-in-outlook-9b47c279-011d-4042-bd7f-8bbfca0cb136)
  - [Loop storage limits](https://support.microsoft.com/en-us/office/microsoft-loop-storage-limits-c2f1a5e9-be65-4289-b322-bae070bfb751)
- Hands-on reviews:
  - [Business Tech Planet](https://businesstechplanet.com/microsoft-loop-components-a-complete-guide-on-how-to-use-them/)
  - [Computerworld](https://www.computerworld.com/article/1621861/how-to-use-microsoft-loop-in-outlook-and-teams.html)
  - [noraajunker.ch](https://noraajunker.ch/loop-3/)
  - SharePoint Maven: [label groups](https://sharepointmaven.com/label-groups-in-microsoft-loop/), [detail pane](https://sharepointmaven.com/detail-pane-in-microsoft-loop/)
  - [XDA (column types)](https://www.xda-developers.com/10-features-microsoft-loop-needs-to-become-a-productivity-powerhouse/)
