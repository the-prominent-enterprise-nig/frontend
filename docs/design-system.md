# Prominent Enterprise — Design System Proposal

> Status: Proposal — do not implement until approved.
> Scope: Full UI/UX overhaul of the React/TypeScript/TailwindCSS frontend.

---

## 1. Audit Summary — What's Broken

### Typography

- `text-base` (16px) is used only 6 times — no established body text size.
- Heading hierarchy relies on zinc color tones rather than size contrast, making it visually flat.
- `font-medium`, `font-semibold`, and `font-bold` are applied inconsistently for the same semantic level.
- No canonical heading component — every page builds its own heading markup.

### Color

- `purple-700` and `prominent-purple-700` both exist and are used for the same purpose in different files — two aliases for one color.
- Alert/status colors (`blue`, `amber`, `emerald`) are not part of the design token system but are scattered throughout inline classnames.
- Destructive/error states use both `red-500` and `red-600` interchangeably.
- Dark mode CSS variables are defined but inconsistently applied — many components ignore them.

### Spacing

- Fractional gaps (`gap-1.5`, `gap-2.5`) appear alongside integers — no clear scale discipline.
- Similar UI elements (cards, modals, list items) use different padding values (`p-4`, `p-5`, `p-6`) without a rule.
- Buttons have no centralized padding standard — every component writes its own `px-4 py-2`.

### Components

- **No centralized Button component.** Every file writes inline Tailwind for buttons — primary, secondary, and cancel buttons are all duplicated 30+ times.
- **No Skeleton/loading component.** Loading states are ad-hoc (spinner only, or disabled button text).
- **No Pagination component** despite tables being central to the app.
- **No Tooltip component.**
- **No Dropdown Menu component** — custom modals are used where a dropdown would suffice.
- Modal structure is consistent in pattern but not extracted into a shared component — the same 20 lines of backdrop/container/header/footer markup are duplicated across every modal.
- Badge/chip styling is inline and inconsistent across modules.

### Layout

- Modal `max-w` varies without rule: `max-w-sm`, `max-w-lg`, `max-w-2xl` — no modal size standard.
- `rounded-xl` vs `rounded-2xl` on modals is inconsistent.
- `shadow-sm` and `shadow-md` are applied without a clear elevation rule.

### UX

- No empty states with illustration or call-to-action — just a muted text line.
- No page-level loading skeleton — content pops in from zero.
- Responsive behavior is inconsistent: some pages handle mobile correctly, others do not.
- No breadcrumb or page context navigation for deeply nested pages.

---

## 2. Design Direction

Reference: Linear, Stripe Dashboard, Vercel, GitHub, Notion.

Principles:

- **Consistency over creativity.** Every UI decision should match an existing pattern.
- **Information density.** Productive for power users. No unnecessary whitespace or decoration.
- **Hierarchy through contrast.** Size, weight, and color work together to guide the eye.
- **Neutral foundation.** Zinc-based palette with deliberate accent color usage.
- **One primary action per view.** Clear dominant CTA at all times.

---

## 3. Color System

### Brand Tokens (already defined in globals.css — keep as-is)

```
prominent-purple-700: #3d2563  ← primary brand, buttons, active states
prominent-purple-800: #2d1b4e  ← button hover
prominent-orange-500: #ff9933  ← accent, badges, highlights
```

### Semantic Tokens (canonical names — use these in all components)

| Token                  | Value                | Usage                                 |
| ---------------------- | -------------------- | ------------------------------------- |
| `color-bg`             | `zinc-50` (#f5f5f5)  | Page background                       |
| `color-surface`        | `white`              | Cards, panels, inputs, modals         |
| `color-border`         | `zinc-200` (#e5e7eb) | All borders (cards, inputs, dividers) |
| `color-border-strong`  | `zinc-300`           | Focus rings, active tab underlines    |
| `color-text-primary`   | `zinc-900`           | Primary content, headings, labels     |
| `color-text-secondary` | `zinc-600`           | Descriptions, metadata                |
| `color-text-muted`     | `zinc-400`           | Placeholders, disabled labels         |
| `color-text-inverse`   | `white`              | Text on dark/brand backgrounds        |

### Status/Semantic Colors

| State   | Background | Border      | Text        |
| ------- | ---------- | ----------- | ----------- |
| Success | `green-50` | `green-200` | `green-700` |
| Warning | `amber-50` | `amber-200` | `amber-700` |
| Error   | `red-50`   | `red-200`   | `red-700`   |
| Info    | `blue-50`  | `blue-200`  | `blue-700`  |
| Neutral | `zinc-100` | `zinc-200`  | `zinc-600`  |

**Rule:** Never use a raw Tailwind color outside this table for status states. Add it to the table first.

### Eliminating the Alias Problem

**Remove all uses of** `purple-*`, `gray-*` **and replace with:**

- `prominent-purple-*` for brand colors
- `zinc-*` for neutrals
- Status colors from the table above

---

## 4. Typography Scale

### Scale

| Role          | Size       | Weight        | Class                                               |
| ------------- | ---------- | ------------- | --------------------------------------------------- |
| Page Title    | 24px (2xl) | semibold      | `text-2xl font-semibold`                            |
| Section Title | 18px (lg)  | semibold      | `text-lg font-semibold`                             |
| Card Title    | 15px (sm+) | semibold      | `text-[15px] font-semibold`                         |
| Body          | 14px (sm)  | normal        | `text-sm font-normal`                               |
| Label         | 14px (sm)  | medium        | `text-sm font-medium`                               |
| Helper/Meta   | 12px (xs)  | normal        | `text-xs font-normal`                               |
| Overline      | 11px       | semibold+caps | `text-[11px] font-semibold uppercase tracking-wide` |
| Stat Value    | 24–30px    | semibold      | `text-2xl font-semibold` or `text-3xl`              |

### Rules

- **No `font-bold` on UI text.** Use `font-semibold` as the maximum weight. `font-bold` is for stat values only.
- **Page titles are always `text-2xl font-semibold text-zinc-900`.** No exceptions.
- **Table column headers are always overline style** (`text-[11px] font-semibold uppercase tracking-wide text-zinc-500`).
- **Form labels are always** `text-sm font-medium text-zinc-700`.
- **`text-base` (16px) is not used** — it is too close to `text-sm` to serve a distinct role.

---

## 5. Spacing Scale

Use only these values. Avoid fractional gaps (`gap-1.5`, `gap-2.5`) in production UI.

### Base Scale

| Token | px   | Usage                                          |
| ----- | ---- | ---------------------------------------------- |
| `1`   | 4px  | Icon-to-label gap, tight badge padding         |
| `2`   | 8px  | Compact list items, small icon buttons         |
| `3`   | 12px | Standard gap between siblings in a row/column  |
| `4`   | 16px | Standard button padding (`px-4`), section gaps |
| `5`   | 20px | Card inner padding (`p-5`)                     |
| `6`   | 24px | Modal header/footer padding, page section gaps |
| `8`   | 32px | Major vertical section separation              |
| `12`  | 48px | Page-level top/bottom breathing room           |

### Component Spacing Rules

| Component           | Rule                                              |
| ------------------- | ------------------------------------------------- |
| Card                | `p-5` internal, `gap-3` between content rows      |
| Modal header/footer | `px-6 py-4`                                       |
| Modal body          | `px-6 py-5 space-y-4`                             |
| Form fields         | `space-y-4` between fields                        |
| Form field columns  | `grid grid-cols-2 gap-3`                          |
| Button group        | `gap-3` between buttons                           |
| List item           | `px-4 py-3` (hover row), `px-5 py-3` (table cell) |
| Section header      | `mb-4` below heading before content               |
| Page top            | `pt-6` or as provided by layout shell             |

---

## 6. Reusable Component Architecture

### Priority 1 — Extract Immediately (High ROI, Prevents Divergence)

#### `Button`

Single canonical component. Variants: `primary`, `secondary`, `ghost`, `destructive`, `link`.
Sizes: `sm`, `md` (default), `lg`.

```tsx
// Usage
<Button variant="primary" size="md">Save Changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="ghost" size="sm" icon={<PlusIcon />}>Add Row</Button>
```

Standard classes per variant:

- primary: `bg-prominent-purple-700 text-white hover:bg-prominent-purple-800`
- secondary: `border border-zinc-200 text-zinc-700 hover:bg-zinc-50`
- ghost: `text-zinc-600 hover:bg-zinc-100`
- destructive: `bg-red-600 text-white hover:bg-red-700`

#### `Modal`

Shared structural component. Accepts: `size` (sm/md/lg/xl), `title`, `description`, `footer`.

```tsx
<Modal size="md" title="Create User" onClose={...}>
  <Modal.Body>...</Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="primary" type="submit">Create</Button>
  </Modal.Footer>
</Modal>
```

Standard modal sizes:

- sm: `max-w-md`
- md: `max-w-xl` (default)
- lg: `max-w-2xl`
- xl: `max-w-4xl`

All modals use `rounded-2xl`, `shadow-xl`.

#### `Input`, `Label`, `FormField`

Consistent input with label, helper text, and error state.

```tsx
<FormField label="Full Name" error={errors.name?.message} required>
  <Input placeholder="John Doe" {...register('name')} />
</FormField>
```

Input states:

- Default: `border-zinc-200 focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100`
- Error: `border-red-400 focus:border-red-500 focus:ring-red-100`
- Disabled: `opacity-50 cursor-not-allowed bg-zinc-50`

#### `Table`

Standardized table with header, body, and optional pagination.

```tsx
<Table>
  <Table.Header columns={columns} />
  <Table.Body rows={rows} />
  <Table.Pagination total={100} page={1} perPage={20} />
</Table>
```

Column header always: `text-[11px] font-semibold uppercase tracking-wide text-zinc-500 bg-zinc-50`

#### `Badge`

Status indicator. Variants: `success`, `warning`, `error`, `info`, `neutral`, `brand`.

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
```

#### `PageHeader`

Consistent page-level heading with optional breadcrumb, subtitle, and action slot.

```tsx
<PageHeader
  title="Employees"
  subtitle="Manage your workforce"
  breadcrumb={[{ label: 'HR', href: '/hr' }, { label: 'Employees' }]}
  action={<Button variant="primary">Add Employee</Button>}
/>
```

#### `EmptyState`

Canonical empty state with icon, message, and optional CTA.

```tsx
<EmptyState
  icon={<UsersIcon />}
  title="No employees yet"
  description="Add your first employee to get started."
  action={<Button variant="primary">Add Employee</Button>}
/>
```

#### `Skeleton`

Loading placeholder. Variants for text lines, cards, rows.

```tsx
<Skeleton className="h-4 w-48" />        // text line
<Skeleton className="h-32 w-full" />     // card
<SkeletonRow columns={5} rows={8} />     // table loading state
```

### Priority 2 — Standardize Existing Patterns

#### `Card`

Canonical card container. Currently: `rounded-xl border border-zinc-200 bg-white shadow-sm`.
Add a `<Card.Header>`, `<Card.Body>`, `<Card.Footer>` API to prevent ad-hoc border-b patterns.

#### `Tabs`

Standardized tab navigation (currently only in InventoryTabNav). Extract to generic component.
Active tab: `border-b-2 border-prominent-purple-700 text-prominent-purple-700 font-medium`
Inactive: `text-zinc-500 hover:text-zinc-700 hover:border-zinc-300`

#### `Avatar`

Circular user avatar with fallback initials. Currently built inline everywhere.

#### `Tooltip`

Does not exist — add via Radix UI Tooltip. Required for icon-only buttons and truncated content.

#### `Select` / `Combobox`

Standardize on Radix UI Select for simple selects. Use the existing CategorySelect for hierarchical data.

#### `Dropdown Menu`

Does not exist as a shared component. Required for row actions (edit/delete menus in tables).

### Priority 3 — New Patterns Needed

| Component        | Reason                                                         |
| ---------------- | -------------------------------------------------------------- |
| `Breadcrumb`     | No page context for nested routes (HR → Employees → John Doe)  |
| `Pagination`     | Tables need standardized page controls                         |
| `CommandPalette` | Power user navigation (Linear-style Cmd+K)                     |
| `DataTable`      | Tables with sort, filter, search — built once, used everywhere |
| `Drawer`         | Side panel for record detail (avoids modal overuse)            |
| `AlertBanner`    | Page-level warnings/notices (currently ad-hoc)                 |
| `ProgressBar`    | Task/onboarding completion indicators                          |

---

## 7. Layout Standards

### Page Shell

All module pages use a consistent shell:

```
┌─────────────────────────────────────────────────┐
│ PageHeader (title, breadcrumb, primary action)   │  h-auto, px-6 pt-6 pb-4
├─────────────────────────────────────────────────┤
│ Filter/Search bar (optional)                     │  px-6 pb-4
├─────────────────────────────────────────────────┤
│ Content area (table or cards)                    │  px-6 pb-8, flex-1
└─────────────────────────────────────────────────┘
```

No page should manage its own top padding — the shell provides it.

### Sidebar

| State     | Width  | Behavior                        |
| --------- | ------ | ------------------------------- |
| Expanded  | `w-60` | Label + icon visible            |
| Collapsed | `w-14` | Icon only, tooltip on hover     |
| Mobile    | hidden | Bottom tab bar (4 items + More) |

State persisted in localStorage. Collapse toggle in sidebar footer.

### Content Width

- Standard page content: `max-w-screen-xl` (1280px), left-aligned
- Narrow forms/modals: contained by component
- Full-width tables: no max-w constraint, just `w-full`

### Z-Index Stack

| Layer          | z-index |
| -------------- | ------- |
| Base content   | 0       |
| Sticky headers | 10      |
| Dropdowns      | 20      |
| Sidebar        | 30      |
| Modals         | 50      |
| Toasts         | 60      |
| Tooltips       | 70      |

### Elevation (Shadow) Rules

| Level  | Class       | Usage                      |
| ------ | ----------- | -------------------------- |
| Flat   | none        | Table rows, list items     |
| Low    | `shadow-sm` | Cards, inputs              |
| Medium | `shadow-md` | Dropdowns, floating panels |
| High   | `shadow-xl` | Modals, command palettes   |

### Border Radius Rules

| Element  | Radius         |
| -------- | -------------- |
| Cards    | `rounded-xl`   |
| Modals   | `rounded-2xl`  |
| Inputs   | `rounded-lg`   |
| Buttons  | `rounded-lg`   |
| Badges   | `rounded-full` |
| Avatars  | `rounded-full` |
| Tooltips | `rounded-md`   |

---

## 8. Migration & Refactor Strategy

### Approach: Parallel Design System + Incremental Module Migration

Do not attempt a big-bang rewrite. Build the design system in `/src/components/ui/` first, then migrate modules one at a time.

### Phase 1 — Foundation (Design System Layer)

**Goal:** Create the canonical component library. No page changes yet.

1. Create `/src/components/ui/button.tsx` — canonical Button component
2. Create `/src/components/ui/input.tsx` + `label.tsx` + `form-field.tsx`
3. Create `/src/components/ui/modal.tsx` — Modal shell (backdrop, container, header, footer)
4. Create `/src/components/ui/badge.tsx`
5. Create `/src/components/ui/card.tsx` — Card with Header/Body/Footer API
6. Create `/src/components/ui/skeleton.tsx`
7. Create `/src/components/ui/empty-state.tsx`
8. Create `/src/components/ui/avatar.tsx`
9. Create `/src/components/ui/tabs.tsx`
10. Create `/src/components/ui/page-header.tsx`
11. Update `globals.css` — add missing semantic status tokens, remove unused utilities, standardize `.input` class to use design tokens
12. Add Radix UI Tooltip to existing Radix dependency and expose `tooltip.tsx`
13. Add Radix UI DropdownMenu and expose `dropdown-menu.tsx`

**Deliverable:** A `/src/components/ui/index.ts` barrel export that any module can import from.

### Phase 2 — Layout & Navigation

**Goal:** Standardize the app shell. All modules benefit immediately.

1. Refactor `SideBar.tsx` — apply new spacing/color tokens, standardize active/hover states
2. Refactor `TopBar.tsx` — consistent height, typography, icon sizes
3. Create `PageShell.tsx` — wraps PageHeader + content area with consistent padding
4. Standardize module shell components (HrShell, etc.) to use PageShell

### Phase 3 — Module Migration (One at a Time)

Priority order (highest traffic + most visible inconsistency first):

1. **Settings** (smallest, most used by admins — quick win)
2. **Human Resources** (most modal-heavy — demonstrates modal component ROI)
3. **Inventory** (most complex tabs/tables — validates DataTable component)
4. **Procurement**
5. **CRM**
6. **Accounting**
7. **Dashboard** (last — widgets are self-contained, lower inconsistency impact)

**For each module:**

- Replace inline button classnames → `<Button>` component
- Replace inline modal markup → `<Modal>` component
- Replace inline badge classnames → `<Badge>` component
- Replace ad-hoc empty states → `<EmptyState>` component
- Replace ad-hoc loading → `<Skeleton>` component
- Apply spacing scale to all gap/padding values
- Apply typography scale to all text elements
- Replace `purple-*` with `prominent-purple-*`
- Replace `gray-*` with `zinc-*`

### Phase 4 — UX Improvements

After components are standardized:

1. Add `Breadcrumb` to all nested module pages
2. Add skeleton loading to all list/table pages
3. Add `EmptyState` with CTA to all empty list pages
4. Add `Tooltip` to all icon-only buttons and truncated text
5. Add `Pagination` to all tables
6. Add `DataTable` with sort + search
7. Consider `Drawer` for record detail views (reduces modal overload)

### Migration Rules

- **Never modify a module page without the design system components available first.**
- **One module per PR.** No cross-module changes in the same PR.
- **Don't refactor business logic while migrating UI.** UI-only changes only.
- **Keep the old classnames as a fallback** until the component is verified in production.
- **Test on desktop (1280px), laptop (1024px), and mobile (375px)** before marking a migration done.

---

## 9. File Structure Proposal

```
/src/components/
├── ui/                          ← Design system primitives
│   ├── index.ts                 ← Barrel export
│   ├── button.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── form-field.tsx
│   ├── modal.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   ├── skeleton.tsx
│   ├── empty-state.tsx
│   ├── avatar.tsx
│   ├── tabs.tsx
│   ├── tooltip.tsx
│   ├── dropdown-menu.tsx
│   ├── data-table.tsx
│   ├── pagination.tsx
│   ├── page-header.tsx
│   ├── breadcrumb.tsx
│   ├── alert-banner.tsx
│   └── drawer.tsx
├── layout/                      ← App shell components
│   ├── SideBar.tsx
│   ├── TopBar.tsx
│   └── PageShell.tsx            ← New
├── dashboard/                   ← Dashboard widgets (isolated)
├── human-resource/              ← HR module components
├── inventory/                   ← Inventory module components
├── procurement/                 ← Procurement module components
├── crm/                         ← CRM module components
├── settings/                    ← Settings module components
├── guards/                      ← Auth guards
└── common/                      ← Cross-module utilities
```

---

## 10. Quick Reference — Before/After

| Pattern        | Before (inconsistent)                                                                         | After (standard)                |
| -------------- | --------------------------------------------------------------------------------------------- | ------------------------------- |
| Primary button | `className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white ..."` | `<Button variant="primary">`    |
| Cancel button  | `className="rounded-lg border border-zinc-200 px-4 py-2 text-sm ..."`                         | `<Button variant="secondary">`  |
| Error badge    | `className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600"`                        | `<Badge variant="error">`       |
| Modal backdrop | 15–20 lines of fixed/overlay markup                                                           | `<Modal size="md" title="...">` |
| Empty state    | `<p className="text-sm text-zinc-500">No items</p>`                                           | `<EmptyState title="..." />`    |
| Loading        | `{isLoading && <Loader2Icon className="animate-spin" />}`                                     | `<SkeletonRow rows={5} />`      |
| Page heading   | `<h1 className="text-2xl font-semibold text-zinc-900">`                                       | `<PageHeader title="..." />`    |
| Status text    | `text-green-600` / `text-emerald-600` / `text-green-500`                                      | `<Badge variant="success">`     |

---

_End of Design System Proposal. Awaiting approval before implementation begins._
