# Prominent Enterprise Design System Rules

<!-- Review note: keep aligned with .skills/ and project conventions -->

## Project Overview

Prominent Enterprise is a comprehensive ERP application built with:

- **Framework**: Next.js (App Router) v16+ with React 19+
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Forms**: React Hook Form with Zod validation
- **Database**: Prisma ORM with PostgreSQL
- **Icons**: Lucide React
- **Modules**: Human Resources, Accounting, Inventory, Dashboard

**Project Structure:**

```
src/
├── app/                  # Next.js routes
│   ├── (app)/(admin)/   # Admin routes (HR, Accounting, Inventory)
│   ├── (app)/(user)/    # Employee self-service routes
│   └── (auth)/          # Login
├── components/          # Reusable React components
├── lib/
│   ├── actions/        # Server actions
│   ├── api/            # API client
│   ├── schemas/        # Zod validation schemas
│   ├── types/          # TypeScript types
│   └── db.ts           # Prisma client
└── .skills/            # AI agent skills
```

---

## Anti-Hallucination Protocol

**⚠️ CRITICAL: These rules override all other guidance. Follow them WITHOUT EXCEPTION.**

### Rule 1: Verify Before You Code

**NEVER rely solely on training data for library-specific APIs.** Before writing any code that uses a library API, consult the project's `.skills/` directory:

| Library              | Skill File                    | Key Reference                        |
| -------------------- | ----------------------------- | ------------------------------------ |
| **React Hook Form**  | `.skills/react-forms/`        | Server actions, Controller, Zod      |
| **Routes & API**     | `.skills/route-architecture/` | (admin)/(user) structure, API routes |
| **API Integration**  | `.skills/api-integration/`    | Server actions, Zod validation       |
| **Components**       | `.skills/component-reuse/`    | Before creating new components       |
| **State Management** | `.skills/component-states/`   | Complex multi-state components       |
| **Clean Code**       | `.skills/clean-code/`         | Naming, functions, organization      |

**Decision flow:**

1. Check `.skills/` for the relevant skill first
2. Follow project conventions exactly
3. If style differs from training data, **use project style**
4. Document your assumptions in code comments

**Anti-patterns (NEVER do these):**

```typescript
// ❌ WRONG - Using register() instead of Controller for custom inputs
import { useForm } from 'react-hook-form';

export function MyForm() {
  const { register } = useForm();
  return <input {...register('email')} />; // See .skills/react-forms
}

// ❌ WRONG - Creating new Button component without checking existing ones
function MyButton() { return <button>...</button>; } // Check .skills/component-reuse

// ❌ WRONG - Complex component without state inventory
function PayrollModal() { // Use .skills/component-states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // ... many useState hooks without structure
}
```

### Rule 2: Component Reuse is Mandatory

**ALWAYS check `.skills/component-reuse/` before creating UI components.**

Before writing new component code:

1. ✅ Search `src/components/` for existing components
2. ✅ Check if you can extend an existing component with props
3. ✅ Document why consolidation wasn't possible (if true)
4. ✅ Only create new component as last resort

**The workflow:**

```
New UI Needed?
  ↓
  Check existing components in src/components/
    ↓ Found exact match?
    └→ YES: Reuse existing → Done
    └→ NO: Found 80%+ similar?
        └→ YES: Extend with props → Done
        └→ NO: Multiple similar patterns?
            └→ YES: Consider consolidation
            └→ NO: Safe to create new
```

### Rule 3: HR/Accounting/Inventory Domain Rules

**When building features for these modules, follow these conventions:**

#### Human Resources (HR)

- **Routes**: `(app)/(admin)/human-resource/` for admin, `(app)/(user)/human-resource/` for employees
- **Key entities**: Employee, Attendance, Leave, Payroll, Payslip, Document
- **Admin actions**: Create/edit employees, manage payroll periods, corrections, postings
- **User actions**: View own payslips, request leave, download documents, view attendance

#### Accounting

- **Routes**: `(app)/(admin)/accounting/`
- **Key entities**: Invoice, Expense, JournalEntry, TrialBalance
- **Admin actions**: Create invoices, track expenses, generate reports, reconciliation

#### Inventory

- **Routes**: `(app)/(admin)/inventory/`
- **Key entities**: Product, Stock, Adjustment, Movement
- **Admin actions**: Manage products, track stock levels, record adjustments

### Rule 4: Form Validation Pattern

**All forms MUST use Zod + React Hook Form pattern from `.skills/react-forms/`:**

```typescript
// ✅ CORRECT pattern

// 1. Define schema in src/lib/schemas/
const employeeSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  department: z.enum(['HR', 'Finance', 'Operations', 'Accounting', 'Inventory']),
});

// 2. Use zodResolver in useForm
const { control, handleSubmit } = useForm({
  resolver: zodResolver(employeeSchema),
});

// 3. Use Controller for all inputs
<Controller
  name="email"
  control={control}
  render={({ field, fieldState }) => (
    <input {...field} />
  )}
/>

// 4. Call server action on submit
const onSubmit = async (data) => {
  const result = await createEmployee(data);
};
```

### Rule 5: Server Actions for Mutations

**All mutations (create, update, delete) use Server Actions:**

```typescript
// ✅ CORRECT - in src/app/actions/payroll.ts

'use server'

export async function createPayrollPeriod(input: unknown) {
  const result = payrollSchema.safeParse(input)
  if (!result.success) {
    return { success: false, error: 'Validation failed' }
  }

  try {
    const period = await db.payrollPeriod.create({ data: result.data })
    revalidatePath('/human-resource/payroll')
    return { success: true, data: period }
  } catch (error) {
    return { success: false, error: 'Failed to create' }
  }
}
```

### Rule 6: API Routes for Complex Operations

**Use API routes for:**

- Complex business logic (payroll compute, attendance corrections)
- Batch operations
- External integrations

**Example:**

```typescript
// ✅ CORRECT - in src/app/api/payroll/[periodId]/compute/route.ts

export async function POST(request: NextRequest, { params }: { params: { periodId: string } }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Compute payroll logic
  const result = await computePayroll(params.periodId)
  return NextResponse.json(result)
}
```

### Rule 7: Route Architecture

**Follow the strict hierarchy:**

```
(app)/
├── (admin)/              ← Admin-only via layout auth check
│   ├── human-resource/
│   │   ├── attendance/
│   │   ├── leave/
│   │   ├── payroll/
│   │   ├── payslips/
│   │   ├── documents/
│   │   └── settings/
│   ├── accounting/
│   ├── inventory/
│   └── dashboard/
└── (user)/               ← User-only via layout auth check
    ├── human-resource/
    │   ├── payslips/     ← Own payslips only
    │   ├── documents/
    │   ├── attendance/
    │   └── leave/
    ├── dashboard/
    └── profile/
```

**Protect at layout level, not page level.**

---

## Quality Standards

### TypeScript

- ✅ Strict mode enabled (`"strict": true` in tsconfig.json)
- ✅ No `any` types — use explicit types
- ✅ All functions have return types
- ✅ Use branded types for IDs (`EmployeeId = string & { readonly __brand: 'EmployeeId' }`)

### Code Style

See `.skills/clean-code/` for complete standards. Quick reference:

- **Naming**: `calculateSalary()` not `calc()`, `isActive` not `active`
- **Functions**: Max 20 lines, single responsibility
- **Comments**: Only "why", not "what"
- **Imports**: Organized by type (React, libs, local)

### Styling

- **Use Tailwind classes exclusively** — no inline styles
- **Leverage design tokens** from `src/app/globals.css`
- **Responsive**: Mobile-first design
- **Accessibility**: Follow WCAG AA standards

### Testing

Tests should cover:

- ✅ Happy path (normal operation)
- ✅ Error cases (validation failures, network errors)
- ✅ Edge cases (empty data, boundary values)

---

## Checklist Before Submitting PR

- [ ] Code follows TypeScript strict mode
- [ ] All forms use React Hook Form + Zod pattern
- [ ] All mutations use Server Actions
- [ ] Routes follow `(app)/(admin/user)/module/` structure
- [ ] No `any` types used
- [ ] Component reuse checked (no duplicates created)
- [ ] Functions are under 20 lines
- [ ] Error handling includes logging and user feedback
- [ ] Sensitive data (salaries, deductions) is never logged
- [ ] Tests pass: `pnpm test`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`

---

## Quick Reference

- **Skills location**: `.skills/` — always read the relevant skill first
- **Routes reference**: See `.skills/route-architecture/SKILL.md`
- **Forms reference**: See `.skills/react-forms/SKILL.md`
- **API patterns**: See `.skills/api-integration/SKILL.md`
- **Component patterns**: See `.skills/component-reuse/SKILL.md`
