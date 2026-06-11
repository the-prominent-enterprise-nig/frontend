# Prominent Enterprise — Frontend

Modern ERP web app for multi-branch businesses. Covers accounting, inventory, POS, CRM, and more.

## Features

- Role-based access control with Auth0
- Accounting, AP/AR, bank reconciliation, budgets
- Inventory with batches, serial numbers, and costing
- Point of Sale with sessions, loyalty, and cash drawer
- CRM with leads, pipeline, and customer management
- Employee workspace (profile, leave, payslips, time log)

## Tech Stack

- Framework: Next.js 16 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS 4, shadcn/ui
- State & Data: Zustand, TanStack Query
- Forms: React Hook Form + Zod
- Auth: Auth0 (nextjs-auth0)

## Prerequisites

- Node.js v22+
- pnpm v10+

## Installation

```bash
git clone <repository-url>
cd frontend
pnpm install
cp .env.example .env.local
# fill in Auth0 and API credentials
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
pnpm dev           # development server
pnpm build         # production build
pnpm type-check    # TypeScript check
pnpm lint          # ESLint
pnpm format        # Prettier
```
