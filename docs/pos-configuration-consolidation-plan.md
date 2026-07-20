# POS Configuration Page — Consolidation & De-duplication Plan

This doc is written for an AI (or engineer) implementing the change with no other context. It states the current state precisely (with file:line references), the target state, and an ordered list of Problem/Fix steps. Read the whole doc before making any edit — several steps have ordering dependencies and a few pages have guard logic that must be preserved exactly, not just "cleaned up."

## Why

The POS module has three overlapping navigation layers — the left **Sidebar** (`src/components/layout/SideBar.tsx`), the in-module top tab bar **PosNav** (`src/app/(app)/(dashboard)/pos/_components/PosNav.tsx`), and a card-list hub page (`/pos/settings`). Built up independently over time, several settings now have 2–3 entry points, some pointing at the same page, some at two different UIs that edit overlapping data. This produces a messy, duplicated feel (Cashier PIN in the sidebar _and_ in a "Configuration" tab; a GL-mapping page that a different field elsewhere silently overrides).

Goal: turn `/pos/settings` into one real, tabbed "POS Configuration" page, reached from exactly one place in each nav layer, and remove every item that already has a perfectly good home elsewhere instead of also appearing under Configuration.

---

## Current state (verified against running code)

### Sidebar — POS segment

`src/components/layout/SideBar.tsx:296-378`, object `navItemsBySegment.pos.main`:

| Label             | href                           | requiredPermission         | activeWhen                                                                 |
| ----------------- | ------------------------------ | -------------------------- | -------------------------------------------------------------------------- |
| Operations        | `/pos`                         | `pos:transactions:read`    | `/pos`, `/pos/checkout`, `/pos/transactions`                               |
| Management        | `/pos/sessions`                | `pos:sessions:read`        | `/pos/sessions`, `/pos/cash-drawer`, `/pos/terminals`                      |
| Cancellations     | `/pos/cancellation-requests`   | `pos:sessions:read`        | —                                                                          |
| Void Requests     | `/pos/void-requests`           | `pos:transactions:read`    | —                                                                          |
| Release Approvals | `/pos/release-approvals`       | `pos:transactions:read`    | —                                                                          |
| Refund Approvals  | `/pos/return-refund-approvals` | `pos:transaction:override` | —                                                                          |
| Promotions        | `/pos/promo-codes`             | `pos:promo-codes:read`     | `/pos/promo-codes`, `/pos/gift-cards`, `/pos/loyalty`                      |
| Branch Pricing    | `/pos/branch-pricing`          | `pos:branch-pricing:read`  | —                                                                          |
| **Configuration** | `/pos/gl-mapping`              | `pos:config:manage`        | `/pos/gl-mapping`, `/pos/settings`, `/pos/config`, `/pos/queue-categories` |
| Cash-in-Transit   | `/pos/cash-in-transit`         | `pos:cash-in-transit:read` | —                                                                          |
| **Cashier PIN**   | `/pos/pin`                     | _(none — every POS role)_  | —                                                                          |

Note the existing code comment at lines 367-371 explaining why Cashier PIN is deliberately its own item, not nested under Configuration: Configuration requires `pos:config:manage` (Business Owner / Branch Manager only); Cashier PIN must stay reachable by Cashiers.

### PosNav — top tab bar (`_components/PosNav.tsx:34-92`)

Renders only when `pathname` is in one of these path lists; `configOnly` items are hidden unless `canConfigurePos` (== `canManagePosSettings(session)`, computed in `pos/layout.tsx:16` and passed down):

- **Operations**: Overview `/pos`, Checkout `/pos/checkout`, Parked Sales `/pos/parked-sales`, Transactions `/pos/transactions`
- **Management**: Sessions `/pos/sessions`, Cash Drawer `/pos/cash-drawer`, **Terminals `/pos/terminals`**
- **Promotions**: Promo Codes `/pos/promo-codes`, Gift Cards `/pos/gift-cards`, Loyalty `/pos/loyalty`, Branch Pricing `/pos/branch-pricing`
- **Configuration**: GL Mapping `/pos/gl-mapping` (configOnly), **Cashier PIN `/pos/pin`** (NOT configOnly — the only item in this group visible to everyone), Queue Categories `/pos/queue-categories` (configOnly), Financing Terms `/pos/financing-terms` (configOnly), Settings `/pos/settings` (configOnly)

### `/pos/settings` hub (`pos/settings/page.tsx`)

A card list (not tabs), gated `canManagePosSettings(session)` else `redirect('/403')`. 11 cards: General Configuration (`/pos/config`), Receipt Branding (`/pos/receipt-branding`), Terminals (`/pos/terminals`), Payment Methods (`/pos/payment-methods`), GL Account Mapping (`/pos/gl-mapping`), Branch Pricing (`/pos/branch-pricing`), Promo Codes (`/pos/promo-codes`), Gift Cards (`/pos/gift-cards`), Loyalty Program (`/pos/loyalty`), Customer Display (`/pos/customer-display`), Financing Terms (`/pos/financing-terms`). Queue Categories is **not** in this list even though it's config-gated elsewhere.

### Per-page guard audit (this matters — see Step 3)

| Route                           | Current guard                                                                                                                                                                                                                                                                                                                                            | Notes                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pos/config/page.tsx`           | `redirect('/login')` + `if (!canManagePosSettings(session)) redirect('/403')`                                                                                                                                                                                                                                                                            | Clean, standard guard                                                                                       |
| `pos/queue-categories/page.tsx` | same as above                                                                                                                                                                                                                                                                                                                                            | Clean, standard guard                                                                                       |
| `pos/gl-mapping/page.tsx`       | same as above                                                                                                                                                                                                                                                                                                                                            | Being deleted (Step 4)                                                                                      |
| `pos/payment-methods/page.tsx`  | **none** — file starts `'use client'` at line 1, no server wrapper, no redirect                                                                                                                                                                                                                                                                          | Currently reachable by anyone with `pos` module access (only _hidden_ from Cashier via nav, not enforced)   |
| `pos/terminals/page.tsx`        | **none** — same as above                                                                                                                                                                                                                                                                                                                                 | Same gap                                                                                                    |
| `pos/customer-display/page.tsx` | **none** — same as above                                                                                                                                                                                                                                                                                                                                 | Same gap (arguably intentional — see Step 3 note)                                                           |
| `pos/receipt-branding/page.tsx` | `redirect('/login')` only — **no** `canManagePosSettings` check. Computes `isBranchManager`/`ownBranch` server-side and passes as props to `ReceiptBrandingClient`                                                                                                                                                                                       | Own logic beyond a guard — must be preserved                                                                |
| `pos/financing-terms/page.tsx`  | `redirect('/login')` + `if (!can(session, POS_PERMISSIONS.FINANCING_TERMS_READ)) redirect('/403')` (a **different**, narrower permission than `canManagePosSettings`), then computes `canManage = can(session, POS_PERMISSIONS.FINANCING_TERMS_MANAGE)` and `restrictedBranchId = session.branchId ?? null`, both passed as props to `FinancingTermList` | Real read/manage distinction + branch-scoping logic — must be preserved, not collapsed into a blanket guard |

### GL Mapping — the concrete duplicate

- `pos/gl-mapping/_components/GlMappingClient.tsx` shows a fixed `POS_KEYS` list (`POS_CASH`, `POS_CARD`, `POS_EWALLET`, `POS_GIFT_CARD`, `POS_BANK_TRANSFER`, `POS_LOYALTY_POINTS`, `POS_STORE_CREDIT`) → GL account, backed by the central `AccountMapping` table (`GET/POST /account-mapping`, `/account-mapping/bulk`).
- `pos/payment-methods/page.tsx` has its own "GL Account (Debit)" field per row (Edit modal, lines 449-468, state `glAccountId`), backed by `PaymentMethodConfig.glAccountId` (`PATCH` via `updatePaymentMethod`).
- Backend resolution order (`backend/src/pos/pos-posting.service.ts:191-213`, `getPaymentMethodAccountId`): **per-method `glAccountId` wins if set**, else falls back to the central mapping key, else `DEFAULT_CASH`, else throws — and the thrown error literally says _"Please set ... in Settings → Account Mapping"_. So Payment Methods' own field is authoritative when set; the separate GL Mapping page only matters for the fallback default.

### Cashier PIN — the concrete duplicate

Three surfaces, not equally accessible:

- `pos/pin/page.tsx` — **no guard at all** (see table above), reachable by every authenticated POS user including Cashier. Component: set/change only (2 modes).
- `PosNav.tsx` Configuration group, "Cashier PIN" entry (`href: /pos/pin`, `configOnly: false`) — links to the exact same page as above, just a second link to it.
- `settings/configuration/_components/PinSection.tsx`, rendered by `settings/configuration/page.tsx`, which **is** gated `canManagePosSettings` (`redirect('/403')` if not Business Owner/Branch Manager). Component: 4 modes (set/view/change/reset) — a superset of `pos/pin`'s features, but a fully separate implementation.

So today: Cashiers can only reach PIN management via `/pos/pin` (Sidebar or PosNav — same target). Business Owner/Branch Manager can reach it via `/pos/pin` **or** `/settings/configuration` (two different implementations of the same feature). This asymmetry is intentional (per the Sidebar code comment) and must be preserved — do not add a `canManagePosSettings` gate to `/pos/pin`.

### Loyalty — mislabeled, not actually configuration

`pos/loyalty/page.tsx` (`'use client'`, no guard, reachable by every POS role via PosNav's Promotions group) is a **customer point-balance lookup tool** — search a Customer ID, see `LoyaltyAccount`/`LoyaltyTransaction` history. It is _not_ a settings form, despite the `/pos/settings` hub card claiming "Configure points earning and redemption rules."

The real settings type/CRUD already exists and is unused by any UI:

- Type `LoyaltyProgram` — `src/schema/pos/index.ts:456-466`: `{ id, tenantId, pointsPerUnit, pointsValue, maxRedeemPct, minimumRedeem, isActive, createdAt, updatedAt }`
- `CreateLoyaltyProgramInput` (`:468-475`), `UpdateLoyaltyProgramInput` (`:477-483`)
- Actions in `pos/_actions/pos-actions.ts`: `getLoyaltyProgram(tenantId)` (`:1233`, hits `GET /pos/loyalty-program/tenant/:tenantId`, returns `{success:false, error:'Loyalty program not found'}` if none exists — **not** a null-success), `createLoyaltyProgram(input)` (`:1249`, `POST /pos/loyalty-program`), `updateLoyaltyProgram(id, input)` (`:1264`, `PATCH /pos/loyalty-program/:id`)

Tenant-scoped-singleton pattern to copy: `getActivePosConfig()` (`pos-actions.ts:1361-1386`) resolves `tenantId = session.enterpriseOwnerId ?? session.id` server-side, tries `GET /pos/config/active`, falls back to `GET /pos/config/tenant/:tenantId`, and always returns `{success:true, data: PosConfig | null}` (never `success:false` just because nothing exists yet). There is **no** confirmed `/pos/loyalty-program/active` backend route — don't assume one exists.

---

## Target architecture

### Sidebar (1 change)

- "Configuration" item: `href` → `/pos/settings` (was `/pos/gl-mapping`). `activeWhen` → `['/pos/settings']` (drop `/pos/gl-mapping`, `/pos/config`, `/pos/queue-categories` — all now live under `/pos/settings/*`, matched by prefix in the item's own active-check, or list them explicitly if `activeWhen` requires exact strings — check how `activeWhen` is matched elsewhere in `SideBar.tsx` before assuming prefix matching).
- No other changes. Cashier PIN, Promotions, Branch Pricing stay exactly as-is.

### PosNav (2 changes)

- **Management** group: remove the Terminals item. Group becomes Sessions, Cash Drawer only.
- **Configuration** group: replace the 5 items with **one**: `{ label: 'Configuration', href: '/pos/settings', icon: Settings, configOnly: true }`. Remove GL Mapping, Cashier PIN, Queue Categories, Financing Terms, Settings as separate entries — Cashier PIN's removal here is safe because it's still reachable from the Sidebar directly; the rest move inside the new shell.
- Because `PosNav`'s `paths` array for group-matching (`GROUPS[i].paths`) is currently an exact list of routes (e.g. `['/pos/gl-mapping', '/pos/pin', '/pos/settings', '/pos/config', '/pos/queue-categories', '/pos/financing-terms']`), and the new shell adds sub-routes under `/pos/settings/*`, update `paths` to include every new `/pos/settings/...` route explicitly (the `activeGroup` lookup at line 102 does `g.paths.includes(pathname)`, an exact-match `.includes()`, not a prefix check) — list all of: `/pos/settings`, `/pos/settings/general`, `/pos/settings/payment-methods`, `/pos/settings/terminals`, `/pos/settings/receipt-branding`, `/pos/settings/financing-terms`, `/pos/settings/queue-categories`, `/pos/settings/customer-display`.
- Promotions group: unchanged.

### New shell: `/pos/settings/*`

```
pos/settings/
  layout.tsx                       (new)
  page.tsx                         (rewritten — redirect to /pos/settings/general)
  _components/
    PosSettingsTabs.tsx             (new)
  general/
    page.tsx                       (moved from pos/config/page.tsx, guard stripped)
    _components/PosConfigClient.tsx (moved from pos/config/_components/, unchanged)
  payment-methods/
    page.tsx                       (moved from pos/payment-methods/page.tsx — was 'use client' page itself; becomes a thin server guard wrapper + new client component, OR add the guard via layout.tsx only — see Step 3)
  terminals/
    page.tsx                       (moved from pos/terminals/page.tsx, same treatment as payment-methods)
  receipt-branding/
    page.tsx                       (moved — KEEP its own isBranchManager/ownBranch logic, do not strip)
    _components/ReceiptBrandingClient.tsx (moved, unchanged)
  financing-terms/
    page.tsx                       (moved — KEEP its own FINANCING_TERMS_READ/MANAGE + restrictedBranchId logic, do not strip)
    _components/FinancingTermList.tsx (moved, unchanged)
  queue-categories/
    page.tsx                       (moved from pos/queue-categories/page.tsx, guard stripped)
    _components/QueueCategoriesClient.tsx (moved, unchanged)
  customer-display/
    page.tsx                       (moved from pos/customer-display/page.tsx)
```

Tab rail order (`PosSettingsTabs.tsx`), with light dividers:

1. General
2. Payment Methods
3. Terminals
4. Receipt Branding
   — divider —
5. Financing Terms
6. Queue Categories
7. Customer Display

**Not moved** — stay at current routes, already reachable via PosNav's Promotions group and/or Sidebar, so their `/pos/settings` hub cards are simply deleted, not relocated: `pos/gift-cards`, `pos/loyalty` (content changes though — see Step 6), `pos/branch-pricing`, `pos/promo-codes`.

**Deleted entirely**: `pos/gl-mapping/` (`page.tsx` + `_components/GlMappingClient.tsx`).

---

## Implementation steps (in order)

### Step 1 — Build the settings shell chrome

Create `pos/settings/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManagePosSettings } from '@/src/libs/guards/permission'
import { PosSettingsTabs } from './_components/PosSettingsTabs'

export default async function PosSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!canManagePosSettings(session)) redirect('/403')

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">POS Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Terminals, pricing rules, payment routing, and other POS-wide settings.
        </p>
      </div>
      <div className="flex">
        <PosSettingsTabs />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
```

This centralizes the `canManagePosSettings` guard for every route under `/pos/settings/*` **except** `payment-methods`, `terminals`, `customer-display` (which had no guard at all before — this layout guard is a net-new, correct restriction for them, a good side effect) and **except** `financing-terms` (whose own page.tsx keeps its narrower `FINANCING_TERMS_READ`/`MANAGE` check — see Step 3's warning) and `receipt-branding` (keeps its own branch-manager-scoping logic — see Step 3).

Create `pos/settings/_components/PosSettingsTabs.tsx` — client component, route-based active state, modeled on `PosNav.tsx`'s own `pathname.startsWith(href)` pattern:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Settings,
  CreditCard,
  Monitor,
  Palette,
  HandCoins,
  LayoutList,
  Tv2,
  type LucideIcon,
} from 'lucide-react'

type TabItem = { label: string; href: string; icon: LucideIcon }
type TabGroup = { items: TabItem[] }

const GROUPS: TabGroup[] = [
  {
    items: [
      { label: 'General', href: '/pos/settings/general', icon: Settings },
      { label: 'Payment Methods', href: '/pos/settings/payment-methods', icon: CreditCard },
      { label: 'Terminals', href: '/pos/settings/terminals', icon: Monitor },
      { label: 'Receipt Branding', href: '/pos/settings/receipt-branding', icon: Palette },
    ],
  },
  {
    items: [
      { label: 'Financing Terms', href: '/pos/settings/financing-terms', icon: HandCoins },
      { label: 'Queue Categories', href: '/pos/settings/queue-categories', icon: LayoutList },
      { label: 'Customer Display', href: '/pos/settings/customer-display', icon: Tv2 },
    ],
  },
]

export function PosSettingsTabs() {
  const pathname = usePathname()
  return (
    <nav className="w-56 shrink-0 border-r border-gray-200 bg-white px-3 py-5">
      {GROUPS.map((group, i) => (
        <div key={i} className={i > 0 ? 'mt-4 border-t border-gray-100 pt-4' : ''}>
          {group.items.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
```

Rewrite `pos/settings/page.tsx` (replaces the 11-card list):

```tsx
import { redirect } from 'next/navigation'

export default function PosSettingsIndexPage() {
  redirect('/pos/settings/general')
}
```

(The `canManagePosSettings` guard is now handled by the parent `layout.tsx` — this page no longer needs its own session fetch.)

### Step 2 — Move the 7 sub-routes

For each of `config→general`, `payment-methods`, `terminals`, `receipt-branding`, `financing-terms`, `queue-categories`, `customer-display`: move the folder (and any `_components/` subfolder) from `pos/<old>/` to `pos/settings/<new>/`, updating relative imports only where the move changes depth (e.g. `../_actions/pos-actions` inside a moved `_components/*.tsx` file now needs to walk up one extra level — check every relative import in every moved file, don't assume none changed). Use `git mv` where possible to preserve history.

### Step 3 — Fix guards per the audit table above (do not blanket-strip)

- `general/page.tsx`, `queue-categories/page.tsx`: safe to delete their own `redirect`/`canManagePosSettings` block entirely — the parent layout now covers it. Keep the rest of each file (just the client-component render) as-is.
- `payment-methods/page.tsx`, `terminals/page.tsx`, `customer-display/page.tsx`: these were pure `'use client'` files with no separate guard. Leave them as pure client components — the new `layout.tsx` (a server component) already wraps them and enforces the guard before they render, so no per-page change is needed here beyond the folder move itself.
- `receipt-branding/page.tsx`: **keep as a server component**, keep its `getSessionOrNull()` call and the `isBranchManager`/`ownBranch` computation exactly as they are today — only difference is it may now skip its own `redirect('/403')` gate since the parent layout already enforces `canManagePosSettings` (verify this page's current lack of that gate wasn't intentionally looser than the rest — if unsure, leave the page's existing checks untouched and let the layout's check simply run first/redundantly; redundant is safe, silently removing a check is not).
- `financing-terms/page.tsx`: **keep entirely as-is** — its own session fetch, its `FINANCING_TERMS_READ` check, its `canManage`/`restrictedBranchId` computation. Before relying on the parent layout's `canManagePosSettings` guard as a first gate, **verify** that every role holding `FINANCING_TERMS_READ` also holds `pos:config:manage` (grep the permission-role seed/matrix, e.g. `backend/prisma` seed files or wherever `POS_PERMISSIONS`/`pos:config:manage` are assigned to roles). If any role has `FINANCING_TERMS_READ` without `pos:config:manage`, the new layout guard would newly lock them out — in that case, do **not** gate this route via the shared layout; special-case it (e.g. move the `canManagePosSettings` check out of `layout.tsx` and into each individual `page.tsx` instead, or split the layout into a guard-free variant for this one route).

### Step 4 — Delete GL Mapping page

Delete `pos/gl-mapping/page.tsx` and `pos/gl-mapping/_components/GlMappingClient.tsx`.

Before deleting, verify in `payment-methods/page.tsx`'s data (`usePaymentMethods()` hook, `pos/_hooks/usePos.ts`) that all 7 standard types are present as rows for a fresh tenant even when disabled: `POS_CASH` (Cash), `POS_CARD` (Card), `POS_EWALLET` (e-wallet), `POS_GIFT_CARD`, `POS_BANK_TRANSFER`, `POS_LOYALTY_POINTS`, `POS_STORE_CREDIT`. If any standard type is **not** seeded as a row by default (only created lazily when a tenant enables it), removing the GL Mapping page would leave that key's _default_ un-settable through any POS UI until the method is first created — in that case, keep a thin "Defaults" section (reusing `GlMappingClient`'s logic, minus the ones already covered as override rows) rather than deleting outright, or link out to `/accounting/account-mapping` (the central page, unfiltered, already covers every key including these).

Optional, low-priority: add a one-line helper note near the "GL Account" column header in `payment-methods/page.tsx` linking to `/accounting/account-mapping`, e.g. "Leave blank to use the tenant default set in Accounting → Account Mapping."

### Step 5 — Sidebar + PosNav edits

Apply the two nav changes described in "Target architecture" above. Grep for any other hardcoded references to `/pos/gl-mapping` first (`grep -rn "pos/gl-mapping" src/`) and update/remove them too.

### Step 6 — Loyalty: split lookup vs. settings, gate the settings half

`pos/loyalty/page.tsx` currently has no guard and no split — anyone can reach it, and it only does customer lookup. Change:

1. Convert `pos/loyalty/page.tsx` into a thin **server** component:

   ```tsx
   import { getSessionOrNull } from '@/src/libs/auth/actions'
   import { canManagePosSettings } from '@/src/libs/guards/permission'
   import LoyaltyClient from './_components/LoyaltyClient'

   export default async function LoyaltyPage() {
     const session = await getSessionOrNull()
     const canManage = session ? canManagePosSettings(session) : false
     const tenantId = session?.enterpriseOwnerId ?? session?.id ?? null
     return <LoyaltyClient canManage={canManage} tenantId={tenantId} />
   }
   ```

   Note: this page stays reachable by **everyone** (no `redirect('/403')`) — only the settings half is conditionally rendered. Don't add a hard guard here; that would break Cashier access to the lookup tool.

2. Move the existing lookup UI (current full contents of `pos/loyalty/page.tsx`) into `pos/loyalty/_components/LoyaltyClient.tsx` as `'use client'`, relabel its header from "Loyalty" to something that matches what it does, e.g. "Look Up Customer Balance" — the existing "Customer Lookup" card header can stay.

3. Inside `LoyaltyClient`, when `canManage` is true, render a new settings card **above** the lookup card:
   - On mount, if `tenantId` is set, call `getLoyaltyProgram(tenantId)`. Because that action returns `{success:false}` when nothing exists yet (not a null-success), treat a failed call as "no program yet" (don't show its `error` as a page-level error) and default the form to blank/zeroed fields with a "Create" button; a successful call means "Save" should call `updateLoyaltyProgram(program.id, ...)` instead.
   - Fields: **Points per Unit** (`pointsPerUnit`, number), **Points Value** (`pointsValue`, number — value of 1 point in currency), **Max Redeem %** (`maxRedeemPct`, 0–100), **Minimum Redeem** (`minimumRedeem`, number), **Active** (`isActive`, toggle) — mirror `PosConfigClient.tsx`'s form structure/styling (labeled fields, `border-t border-gray-100 pt-4` dividers, save button with `Loader2`/`CheckCircle2` states) for visual consistency.
   - On create, call `createLoyaltyProgram({ tenantId, pointsPerUnit, pointsValue, maxRedeemPct, minimumRedeem, isActive })`.
   - On update, call `updateLoyaltyProgram(program.id, { pointsPerUnit, pointsValue, maxRedeemPct, minimumRedeem, isActive })`.
   - No new backend endpoint is needed — `getLoyaltyProgram`/`createLoyaltyProgram`/`updateLoyaltyProgram` already exist and are unused today.

4. Delete the "Loyalty Program" card from the (now-deleted) `/pos/settings` hub — it was never moved into the shell; it stays reachable only via PosNav's Promotions group, same as today, just now doing what its label always claimed.

### Step 7 — Cashier PIN: extract shared component, keep both entry points

Per product decision: keep both `/pos/pin` (Sidebar/PosNav, no guard, every POS role) and `/settings/configuration` → POS PIN tab (gated `canManagePosSettings`, Business Owner/Branch Manager) — they serve genuinely different audiences (see "Current state" above), just stop maintaining two separate implementations.

1. Create `src/components/pos/CashierPinManager.tsx` as the **superset** of the two existing components — take `PinSection.tsx`'s 4-mode structure (`set` / `view` / `change` / `reset`) as the base (it's the more complete one), keep its `PinInput`/`Banner`/mode-card sub-components. Accept a prop `initialHasPin: boolean` exactly like `PinSection` does today, and keep the same `registerCashierPin`/`changeCashierPin` imports from `pos/_actions/pos-actions`.
2. `pos/pin/page.tsx`: today it doesn't fetch `hasPin` status up front (it always starts in "set" mode with no "already have a PIN" awareness — check this against `getCashierPinStatus()`, already defined in `pos-actions.ts:1390`, which `PinSection`'s caller (`settings/configuration/page.tsx:20`) already uses). To match behavior, make `pos/pin/page.tsx` a server component too:

   ```tsx
   import { getCashierPinStatus } from '../_actions/pos-actions'
   import { CashierPinManager } from '@/src/components/pos/CashierPinManager'

   export const metadata = { title: 'Cashier PIN | Prominent Enterprise' }

   export default async function CashierPinPage() {
     const statusRes = await getCashierPinStatus()
     return (
       <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
         <div className="mx-auto max-w-2xl">
           <div className="mb-4 sm:mb-6">
             <h1 className="text-2xl font-bold text-gray-900">Cashier PIN</h1>
             <p className="mt-1 text-sm text-gray-500">
               Set or update your PIN used to identify yourself and authorize POS approvals.
             </p>
           </div>
           <CashierPinManager initialHasPin={statusRes.data?.hasPin ?? false} />
         </div>
       </div>
     )
   }
   ```

   No permission guard added here — deliberately, to preserve Cashier access.

3. `settings/configuration/_components/ConfigurationTabs.tsx`: replace its `<PinSection initialHasPin={initialHasPin} />` (line ~52) with `<CashierPinManager initialHasPin={initialHasPin} />`, updating the import. Delete `settings/configuration/_components/PinSection.tsx`.
4. Confirm the two entry points now visually match (same 4-mode flow) and delete the now-orphaned `pos/pin/page.tsx`'s old inline component code once `CashierPinManager` is wired in.

### Step 8 — Cross-link cleanup

Grep the frontend for every hardcoded reference to a route that moved or was removed, and fix each:

```
grep -rn "'/pos/config'\|\"/pos/config\"\|/pos/config[^-]" src/ --include=*.tsx --include=*.ts
grep -rn "/pos/payment-methods" src/
grep -rn "/pos/gl-mapping" src/
grep -rn "/pos/terminals" src/
grep -rn "/pos/receipt-branding" src/
grep -rn "/pos/financing-terms" src/
grep -rn "/pos/queue-categories" src/
grep -rn "/pos/customer-display" src/
```

Update every match outside the files touched in Steps 1-2 (e.g. dashboard quick-links, onboarding checklists, breadcrumbs, other modules linking into POS settings) to the new `/pos/settings/...` path. Leave matches inside `financing-terms`'s own internal links alone if they're relative (`Link href="."`-style) since folder relocation keeps those correct automatically — only fix absolute hardcoded paths.

---

## Verification checklist

Use the seeded dev accounts already documented in `docs/pos-installment-plan.md` (dev-bypass login, password `dev-prominent-enterprise-2026`): `technova.owner@test.com` (Business Owner), `technova.b1.manager@test.com` (Branch Manager, Manila), `technova.b1.cashier@test.com` (Cashier, Manila).

1. **Shell navigation**: as Business Owner, click Sidebar "Configuration" → lands on `/pos/settings` → redirects to `/pos/settings/general` → left rail shows General highlighted. Click each of the other 6 tabs, confirm each loads its moved content correctly and the rail highlights the right tab.
2. **PosNav collapse**: while on any `/pos/settings/*` route, confirm PosNav's top bar shows a single "Configuration" tab (highlighted), not 5 separate tabs.
3. **Terminals moved out of Management**: click Sidebar "Management" → PosNav should show only Sessions and Cash Drawer (no Terminals tab). Confirm Terminals still works by reaching it via Configuration → Terminals tab.
4. **GL Mapping removed, Payment Methods still covers it**: confirm `/pos/gl-mapping` 404s (or redirects, if you added one). In Configuration → Payment Methods, confirm every standard payment type row still has a working "GL Account" dropdown, and that setting it there actually affects posting (sell something with that payment method, check the resulting JE's debit account in Accounting → Journal Entries).
5. **Cashier PIN — both entry points, one component**: as Cashier, confirm `/pos/pin` works with no 403 (Sidebar "Cashier PIN" item, and it's absent from PosNav's now-single "Configuration" tab area since Cashier can't see Configuration at all). As Business Owner, confirm both `/pos/pin` and My Workspace → Configuration → POS PIN tab show the identical 4-mode UI and both reflect the same underlying PIN state (set it in one, confirm "already has a PIN" state shows in the other after refresh).
6. **Loyalty split**: as Cashier, go to POS → Promotions → Loyalty — confirm the customer-lookup tool works and **no** settings form is visible. As Business Owner, same page — confirm a settings form appears above the lookup tool, showing "Create" if no program exists yet, or the current values with "Save" if one does. Create/update it, refresh, confirm values persist.
7. **Financing Terms permission preserved**: re-run the existing test from `pos-installment-plan.md` Phase 3a (Business Owner sees a Branch dropdown when creating a term; Branch Manager sees a locked read-only branch; Cashier gets redirected to `/403`) — now via Configuration → Financing Terms tab instead of the old standalone nav entry, to confirm the branch-scoping and read/manage split survived the move.
8. **Receipt Branding scoping preserved**: confirm the Branch Manager-only "override for one branch" behavior still works from its new location.
9. **Cross-links**: grep again after all edits (`grep -rn "/pos/config\b\|/pos/gl-mapping\|/pos/payment-methods\|/pos/terminals\|/pos/receipt-branding\|/pos/financing-terms\|/pos/queue-categories\|/pos/customer-display" src/`) and confirm zero remaining hits point at a route that no longer exists at that path.

## Implementation Log — 2026-07-20

**For this scenario, I have done:**

- Steps 1–6 (settings shell chrome, sub-route moves, per-page guard fixes, GL Mapping page deletion, Sidebar/PosNav edits, Loyalty lookup/settings split): implemented and committed (`5b65cf4`, e2e: `pos-settings-consolidation.spec.ts`, `pos-loyalty-split.spec.ts`).
- Step 7 (Cashier PIN — extract `CashierPinManager` as the single shared implementation behind both entry points) and Step 8 (cross-link cleanup — 3 stale hardcoded references fixed): implemented and committed as "Parts 5-6" (`aa0215d`), renamed the feature to "POS PIN" everywhere per confirmed naming.
- Configuration removal (not one of the original Steps 1-8 — a later, separate decision; see "Worth flagging" below): `/settings/configuration` removed entirely — page, tabs, components, and the Sidebar nav item (both Business Owner and Branch Manager) all deleted. Its Payment Methods tab migrated into `/pos/settings/payment-methods` as a new "Business-wide payment methods" section (the real, checkout-enforced toggle, now visually distinguished from the per-method table's own "Visible at Checkout" column). Its Receipt Branding tab migrated into `/pos/settings/receipt-branding`, reusing the page's existing branch switcher as the mode selector ("All Branches" edits the company-wide default, a specific branch edits its own override) instead of a separate tab. New e2e: `pos-config-migration.spec.ts`; updated `pos-cashier-pin-unification.spec.ts` and `pos-settings-consolidation.spec.ts` to match. Verified clean (`tsc`, `eslint`, all 3 relevant e2e specs) but **not yet committed**.

**Worth flagging:**

- Step 7 above explicitly documented a product decision to _keep_ `/settings/configuration` as a separate PIN entry point ("they serve genuinely different audiences"). That decision was later revisited and reversed — Configuration was removed entirely rather than left as a second entry point. This log entry supersedes Step 7's stated rationale: the shared `CashierPinManager` component built in Step 7 is now reached only via `/pos/pin`.
- The Configuration-removal work added `OwnerPaymentMethodsSection` (a business-wide enable/disable toggle) into `/pos/settings/payment-methods` for the first time. This created two visibly separate "is this payment method enabled?" controls on that page (the new business-wide toggle vs. the existing per-method table) — which is the subject of a separate, in-progress backend+frontend merge (unifying both into one system, checked at checkout). Once that merge's frontend phase lands, `OwnerPaymentMethodsSection` and this migration's business-wide toggle will be removed again in favor of the per-method table's own toggle becoming the single real control.

## Payment-method system merge — completed 2026-07-20

The "separate, in-progress backend+frontend merge" flagged above is done. Backend work happened on `refactor/pos-payment-method-merge` (backend repo); this repo's changes landed alongside it, still uncommitted on `feat/pos-config-consolidation`.

**Backend** (`PosPaymentMethodConfig` + new `PosPaymentMethodBranchOverride` is now the single, authoritative system — "System B" in the migration scripts' comments; the old enum-based `BusinessOwnerPaymentMethod`/`BranchPaymentMethodOverride` — "System A" — is retired):

- Added branch-level override endpoints to System B: `GET/PATCH /pos/branches/:branchId/payment-method-configs`, `DELETE .../overrides` (`branch-payment-method-configs.controller.ts`, new service methods on `PaymentMethodsService`), mirroring what the old `BranchPaymentMethodsController` did for the enum system.
- Ran `backfill-payment-method-configs.ts` (copies System A's enabled/disabled state into System B) and `split-e-wallet-into-gcash-maya.ts` (fixes a stale pre-split seed) against the dev DB, then `verify-payment-method-parity.ts` to confirm the two systems agreed everywhere before touching anything destructive. Both one-off scripts deleted after their (verified-clean) run — their source tables no longer exist to re-run against. `split-e-wallet-into-gcash-maya.ts` kept (still valid, doesn't touch System A tables).
- Removed the dead `BranchPaymentMethodsService` constructor param from `TransactionsService` (checkout gate already queried System B directly as of Phase 3; the enum-based service was still injected but unused).
- Deleted System A entirely: `branch-payment-methods.controller.ts` (`OwnerPaymentMethodsController` + `BranchPaymentMethodsController`), `branch-payment-methods.service.ts`, the `BusinessOwnerPaymentMethod`/`BranchPaymentMethodOverride` Prisma models and their relation fields, the `owner_payment_methods`/`branch_payment_method_overrides` tables (migration `20260720014334_retire_owner_and_branch_payment_method_overrides`), and the dead owner-payment-methods seeding block in `prisma/seed.ts`.
- Verified clean: full unit suite (417 tests), `tsc`, `eslint`, and all POS e2e specs (run individually — some fail when run concurrently with other e2e files due to pre-existing terminal-contention flakiness unrelated to this change).

**Frontend** (this repo):

- Deleted `OwnerPaymentMethodsSection.tsx` and its `owner-payment-methods.ts` action, and removed the "Business-wide payment methods" section from `/pos/settings/payment-methods` — the per-method table's own "Visible at Checkout" toggle is now the single real, checkout-enforced control, exactly as flagged above.
- Repointed `settings/branches/[id]/_actions/branch-payment-methods.ts` and `BranchPaymentMethodsSection.tsx` from the old enum-keyed endpoint to the new `PosPaymentMethodConfig`-keyed one — the component now keys rows by config `id` instead of the `PosPaymentMethod` enum, and shows `tenantEnabled` instead of `ownerDefault`.
- Repointed `getEnabledBranchPaymentMethods` (`pos-actions.ts`, used by the live checkout page to filter which methods a cashier can select) to the new endpoint; it derives the enum-key list from resolved config rows (`key`, or `'custom'` for any enabled custom config) since checkout still reasons about the enum + a configId, not raw config rows.
- Updated `schema/pos/index.ts`: removed `OwnerPaymentMethod`/`OwnerPaymentMethodsResponse`; `BranchPaymentMethod` now extends `PaymentMethodConfig` with `isOverridden`/`tenantEnabled`.
- Updated `pos-config-migration.spec.ts`'s payment-methods test (the old assertions targeted the now-deleted business-wide section) and a stale comment in `pos-settings-consolidation.spec.ts`. Verified clean: `tsc`, `eslint`, both specs passing against the live dev server, plus an ad hoc manual Playwright check of the branch-detail Payment Methods section (load → edit → toggle → save → persisted correctly, then test data cleaned up).
- Nothing has been committed yet in either repo.
