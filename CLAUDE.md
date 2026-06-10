# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm type-check   # TypeScript check (no emit)
pnpm lint         # ESLint
pnpm lint:fix     # ESLint with auto-fix
pnpm format       # Prettier write
pnpm format:check # Prettier check
pnpm generate:types  # Regenerate OpenAPI types from localhost:3001
```

No test suite is configured — `pnpm test` is a no-op.

## Architecture

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · Auth0 v4 · TanStack Query v5 · Zustand v5 · React Hook Form + Zod · next-safe-action

**This is a frontend-only app.** There is no local database or ORM. All data comes from a separate backend API running at `localhost:3001` during development.

### API Client (`src/libs/api/client.ts`)

The `api` client auto-routes:

- **Browser**: requests go through Next.js `/api/*` proxy (so the httpOnly `authToken` cookie is sent automatically)
- **Server-side**: requests hit `API_URL` (default `http://localhost:3001`) with the `authToken` cookie injected from headers

Do not collapse these two paths. Use `api.get()`, `api.post()`, etc. for most calls; use `apiCallWithValidation()` when you want Zod validation on both request and response.

### Routing structure

```
src/app/
├── (app)/                  # Requires authenticated session (layout check)
│   ├── (dashboard)/        # Main dashboard widgets
│   ├── accounting/
│   ├── crm/
│   ├── human-resource/     # Leave, payroll, attendance, employees
│   ├── inventory/
│   ├── pos/
│   ├── procurement/
│   ├── sales/
│   ├── settings/           # RBAC settings
│   └── workspace/
├── (auth)/                 # Login (redirects if already authed)
├── (super-admin)/          # Super-admin only
├── api/                    # Next.js API routes (proxy to backend)
├── onboard/                # Enterprise onboarding
└── 403/, not-found.tsx
```

Auth and access guards live at **layout level**, never page level.

### Permissions (`src/libs/guards/permission.ts`)

Permissions follow the pattern `module:resource:action` (e.g. `hr:attendance:update`). Key helpers:

- `can(user, permission)` — single permission check; wildcards supported
- `canAll(user, perms[])` — must have all
- `canAny(user, perms[])` — must have at least one
- `canAccessModule(user, module)` — module-level gate
- `hasPrivilegedRole(user)` — enterprise-owner bypasses all checks
- `isSuperAdmin(user)` — super-admin flag check

`SessionUser` (from `src/libs/guards/permission.ts`) is the canonical user shape; obtain it via the `useMe()` hook or `parseSessionUser()` server-side.

### Mutations: Server Actions

All create/update/delete operations use Next.js Server Actions (in `src/libs/actions/`) with `next-safe-action`. Pattern:

```typescript
'use server'
export const createFoo = authAction
  .schema(fooSchema)
  .action(async ({ parsedInput }) => { ... })
```

### Forms

Always use `react-hook-form` + `zodResolver` + `Controller` for custom inputs. Define Zod schemas in `src/schema/<module>/`. The `register()` pattern is not used — use `Controller` for every field.

### Key directories

| Path                     | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `src/libs/actions/`      | Server actions (mutations)                       |
| `src/libs/api/`          | API client + module-specific fetch helpers       |
| `src/libs/guards/`       | Permission logic and module access rules         |
| `src/libs/query/`        | TanStack Query hooks                             |
| `src/libs/generated/`    | OpenAPI-generated TypeScript types (do not edit) |
| `src/schema/`            | Zod validation schemas per module                |
| `src/components/ui/`     | Core design-system components                    |
| `src/components/guards/` | Permission guard React components                |
| `src/stores/`            | Zustand stores                                   |
| `src/hooks/`             | Shared hooks (`useMe`, `usePermission`, etc.)    |

### Design tokens

Colors and typography are defined as CSS variables in `src/app/globals.css`. Brand: Prominent Purple `#3D2563` + Bright Orange `#FF9933`. Font: Poppins. Use Tailwind utility classes exclusively — no inline styles.

### Environment variables

| Variable                                                                                   | Used                                         |
| ------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `AUTH0_SECRET` | Auth0 server-side                            |
| `APP_BASE_URL`                                                                             | Callback URLs                                |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID`, `NEXT_PUBLIC_AUTH0_DOMAIN`                                  | Auth0 client-side                            |
| `API_URL`                                                                                  | Backend URL (server-side only)               |
| `NEXT_PUBLIC_API_URL`                                                                      | Backend URL for browser (defaults to `/api`) |
| `NEXT_PUBLIC_DEBUG_API=true`                                                               | Enable API request logging                   |

## Code conventions

- **No `any` types.** Use `unknown` or generate types with `pnpm generate:types`.
- **All functions have explicit return types.**
- **Functions max ~20 lines, single responsibility.**
- **Check `src/components/` before creating a new component.** Extend with props if 80%+ similar.
- **Skills reference**: `.skills/` directory contains project-specific patterns for forms, routing, API integration, component reuse, and state management. Read the relevant skill file before coding in unfamiliar areas.
- Prettier config: no semicolons, single quotes, trailing comma `es5`, 100-char line width.
- Commit style: conventional commits — `feat(hr): add leave request`, `fix(payroll): correct period dates`.
