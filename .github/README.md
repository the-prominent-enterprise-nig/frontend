# NIG Central

NIG Central is a modern ERP web application that automates repetitive tasks, reduces paperwork, and streamlines business workflows with structured systems. Built with Next.js 16, React 19, and TypeScript.

## Tech Stack

| Layer           | Technology                                                                |
| --------------- | ------------------------------------------------------------------------- |
| Framework       | [Next.js 16.1.6](https://nextjs.org) (App Router)                         |
| UI              | [React 19.2.3](https://react.dev)                                         |
| Language        | [TypeScript 5.x](https://www.typescriptlang.org)                          |
| Styling         | [Tailwind CSS 4.x](https://tailwindcss.com)                               |
| Forms           | [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev)   |
| State           | [Zustand](https://zustand-demo.pmnd.rs)                                   |
| Data Fetching   | [TanStack Query v5](https://tanstack.com/query)                           |
| Components      | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) |
| Auth            | [Auth0 (nextjs-auth0)](https://auth0.com)                                 |
| Server Actions  | [next-safe-action](https://next-safe-action.dev)                          |
| URL State       | [nuqs](https://nuqs.47ng.com)                                             |
| Notifications   | [Sonner](https://sonner.emilkowal.ski)                                    |
| Package Manager | [pnpm 10.x](https://pnpm.io)                                              |

## Prerequisites

- **Node.js** v22.13 or higher
- **pnpm** v10.x — install with `npm install -g pnpm@10`

## Getting Started

```bash
# 1. Clone the repo
git clone <repository-url>
cd prominent-enterprise-app

# 2. Install dependencies
pnpm install

# 3. Copy environment variables
cp .env.example .env.local
# Edit .env.local and set NEXT_PUBLIC_API_URL

# 4. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Script                | Description                                  |
| --------------------- | -------------------------------------------- |
| `pnpm dev`            | Start the development server                 |
| `pnpm build`          | Create an optimized production build         |
| `pnpm start`          | Start the production server (requires build) |
| `pnpm type-check`     | Run TypeScript compiler checks               |
| `pnpm lint`           | Run ESLint                                   |
| `pnpm lint:fix`       | Run ESLint and auto-fix issues               |
| `pnpm format`         | Format all files with Prettier               |
| `pnpm format:check`   | Check formatting without writing             |
| `pnpm generate:types` | Generate TypeScript types from OpenAPI spec  |

## Modules

| Module           | Route               | Description                                                                       |
| ---------------- | ------------------- | --------------------------------------------------------------------------------- |
| Dashboard        | `/dashboard`        | Role-based widget dashboard                                                       |
| Accounting       | `/accounting`       | Journal entries, COA, AP/AR, bank reconciliation, fiscal periods, tax, budgets    |
| CRM              | `/crm`              | Leads, customers, pipeline, reminders, segments                                   |
| Human Resource   | `/human-resource`   | Employees, payroll, payslips, leave, attendance, holidays                         |
| Inventory        | `/inventory`        | Items, stock, warehouses, transfers, batches, serial numbers, costing, purchasing |
| Point of Sale    | `/pos`              | Checkout, sessions, terminals, loyalty, promos, cash drawer                       |
| Procurement      | `/procurement`      | Purchase requests, purchase orders, goods receiving, suppliers                    |
| Queue Management | `/queue-management` | Queue dashboard, public display, reports, settings                                |
| Sales            | `/sales`            | Orders, quotations, invoices, deliveries, returns                                 |
| Settings         | `/settings`         | Users, roles, permissions, branches, system config                                |
| My Workspace     | `/workspace`        | Personal profile, payslips, leave, time log                                       |

## Project Structure

```
src/
├── app/
│   ├── (app)/
│   │   └── (dashboard)/         # All authenticated module pages
│   │       ├── accounting/
│   │       ├── crm/
│   │       ├── human-resource/
│   │       ├── inventory/
│   │       ├── pos/
│   │       ├── procurement/
│   │       ├── queue-management/
│   │       ├── sales/
│   │       ├── settings/
│   │       └── workspace/
│   ├── (auth)/
│   │   └── login/
│   └── api/                     # Next.js API proxy routes
├── components/
│   ├── common/                  # Shared cross-module components
│   ├── crm/
│   ├── dashboard/               # Dashboard widgets
│   ├── guards/                  # Permission guard components
│   ├── human-resource/
│   ├── inventory/
│   ├── layout/                  # TopBar, SideBar
│   ├── procurement/
│   ├── settings/
│   ├── shell/                   # App shell providers
│   ├── ui/                      # shadcn/ui primitives
│   └── workspace/
├── libs/
│   ├── actions/                 # next-safe-action server actions
│   ├── api/                     # API client functions per module
│   ├── auth/                    # Auth0 session handling
│   ├── data/                    # Mock/static data
│   ├── generated/types/         # Auto-generated OpenAPI types
│   ├── guards/                  # RBAC permission helpers (per module)
│   ├── payroll/                 # Payroll calculation helpers
│   ├── query/                   # TanStack Query stale-time config
│   └── flags.ts                 # Feature flags
├── schema/                      # Zod schemas per module
├── stores/                      # Zustand stores
└── types.d.ts
```

## Environment Variables

| Variable                      | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `AUTH0_DOMAIN`                | Auth0 tenant domain (e.g. `your-tenant.auth0.com`)  |
| `AUTH0_CLIENT_ID`             | Auth0 application client ID                         |
| `AUTH0_CLIENT_SECRET`         | Auth0 application client secret                     |
| `AUTH0_AUDIENCE`              | Auth0 API identifier                                |
| `AUTH0_SECRET`                | Long random string for session encryption           |
| `APP_BASE_URL`                | Application base URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Auth0 client ID (public, for browser)               |
| `NEXT_PUBLIC_AUTH0_DOMAIN`    | Auth0 domain (public, for browser)                  |

## CI / CD

GitHub Actions runs on every push and pull request to `main`:

1. **Quality Checks** — TypeScript, Prettier, ESLint
2. **Build Verification** — `next build`
3. **Tests** — test suite

## License

Private
