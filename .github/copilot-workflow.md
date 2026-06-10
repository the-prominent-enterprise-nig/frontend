# Prominent Enterprise Team Workflow

**⚠️ IMPORTANT: These workflow rules are mandatory for all agents. Follow them in order.**

> This file is referenced by `.github/copilot-instructions.md`. Keep both files in sync.

---

## Workflow Modes

### Autonomous Mode (Default for Implementation)

**When user provides clear task specifications:**

- ✅ **No user questions** - Make reasonable decisions based on project conventions
- ✅ **Self-validation** - Loop through implementation until all criteria pass
- ✅ **Auto-correction** - Fix issues automatically without asking
- ✅ **Final delivery** - Present complete, validated result only

**Autonomous mode triggers:**

- Clear task description (feature, bug fix, refactoring)
- Design specs provided (Figma URL, screenshots)
- Task is "implement", "build", "create", "fix"

### Interactive Mode

**When user requests collaboration or specs are unclear:**

- Agent asks clarifying questions before implementation
- User approves plans before execution
- Agent reports blockers and asks for decisions

**Interactive mode triggers:**

- User asks "help me plan", "what approach should we use"
- Requirements are ambiguous or incomplete
- Architectural changes or new patterns

---

## Phase 0: Task Assessment (Before Any Work)

**⚠️ Required for complex features. Skip only for simple bug fixes or single-file changes.**

**Complexity scoring:**

| Signal                       | Points | Example                                              |
| ---------------------------- | ------ | ---------------------------------------------------- |
| Multiple components (3+)     | 2      | Building attendy tracker form with multiple sections |
| Database migration           | 2      | New entity, schema change                            |
| API route + Server Action    | 2      | Create payroll compute endpoint                      |
| Authentication/authorization | 1      | Protected routes, role checks                        |
| State management             | 1      | Complex modal states, multi-step flows               |
| Third-party integration      | 2      | Reporting tools, payment processing                  |

**Score interpretation:**

- **0–2 points**: Single task, can proceed directly
- **3–5 points**: Recommend breaking into sub-tasks
- **6+ points**: MUST split into multiple tasks to avoid context drift

**When splitting is needed (3+ points), output:**

```
## Proposed Task Breakdown

### Task 1: [Feature] Create Payroll Period Management
- [ ] Create database schema and migration
- [ ] Implement API routes (GET, POST, PUT)
- [ ] Build admin form component
- [ ] Add validations and error handling
**Estimate**: 3–4 hours

### Task 2: [Feature] Build Payroll Computation Engine
- [ ] Compute salary calculations
- [ ] Handle deductions and withholdings
- [ ] Generate payslip records
- [ ] Create posting to accounting module
**Estimate**: 4–5 hours

(Remaining tasks...)

---

**Which task should we start with?**
```

---

## Phase 1: Task Planning & Breakdown (Autonomous Mode)

**When in autonomous mode, agents MUST:**

1. **Read and understand** the complete task description
2. **CRITICAL: Component Reuse Protocol** (applies to ALL UI implementation):

   **See `.skills/component-reuse/SKILL.md` for complete protocol.**

   **Quick checklist:**
   - [ ] Search `src/components/` for base components (Button, Input, Card, Badge, Modal, etc.)
   - [ ] Search for domain-specific components (HR, Accounting, Inventory related)
   - [ ] Search `src/lib/schemas/` for existing Zod schemas
   - [ ] **NEVER create a new component if a reusable one exists**
   - [ ] Identify consolidation opportunities (duplicated patterns)
   - [ ] Document reuse decisions

3. **Create a task plan** silently using todo tracking:
   - Clear, actionable items
   - Logical order (dependencies first)
   - Realistic scope (break large tasks into sub-tasks)

4. **Verify prerequisites** silently:
   - Necessary libraries available
   - Database schema supports required fields
   - API endpoints exist or need to be created
   - Existing components identified
   - Domain knowledge verified (HR, Accounting, Inventory rules)

5. **Make reasonable assumptions** for ambiguous cases:
   - Use project conventions from `.github/copilot-instructions.md`
   - Follow existing patterns in codebase
   - Prefer component reuse over creation (see rule 2 above)
   - Default to client component unless needs server data
   - Use design tokens from `globals.css`

**Task breakdown template:**

```
📋 Plan:

Phase 1: Research & Prerequisites
  [ ] Review existing Payroll components
  [ ] Check PayrollPeriod schema
  [ ] Identify form fields needed
  [ ] List API endpoints to create

Phase 2: Implementation
  [ ] 🟢 Create PayrollPeriodForm component (no deps)
  [ ] 🟡 Create PayrollPeriodList component (uses form)
  [ ] 🟡 Implement createPayrollPeriod server action
  [ ] 🟠 Create /api/payroll endpoints
  [ ] 🟠 Add PayrollPeriod database migration

Phase 3: Validation
  [ ] Lint check
  [ ] Build verification
  [ ] Manual testing of workflows
```

---

## Phase 2: Implementation & Self-Validation Loop (Autonomous Mode)

**Agent implements continuously until all criteria pass:**

### The Autonomous Loop

```
1. Implement → 2. Test → 3. Validate → 4. Fix Issues → [Repeat until PASS]
                                              ↑                |
                                              └─[If fail]──────┘
```

**Loop continues until:**

- ✅ TypeScript compiles without errors
- ✅ No linting warnings (`pnpm lint`)
- ✅ Build succeeds (`pnpm build`)
- ✅ All tests pass (if applicable)
- ✅ No console errors or warnings
- ✅ Follows project conventions from `.skills/`

### Silent Progress Tracking

**Agent tracks progress internally without user interruption:**

```
Internal checklist:
✅ Phase 1: Requirements review [COMPLETE]
🔄 Phase 2: Implementation
   ✅ Component structure [DONE]
   🔄 Form validation [IN PROGRESS]
   ⏳ Server action integration [PENDING]
🔄 Phase 3: Validation [PENDING]
```

### Auto-Correction Protocol

**When any check fails, agent automatically:**

1. **Identify root cause** from error message
2. **Apply fix** based on project patterns
3. **Re-run check**
4. **Document what was fixed** in implementation notes

**Common issues and auto-fixes:**

| Issue                          | Auto-Fix                              |
| ------------------------------ | ------------------------------------- |
| TypeScript error: Missing type | Add explicit return type or interface |
| Lint error: Unused import      | Remove import automatically           |
| Lint error: var/let usage      | Replace with const                    |
| Component not found            | Check imports, verify path correct    |
| Zod validation failed          | Add `refine()` or adjust schema       |
| Database error                 | Add migration, verify schema matches  |

---

## Phase 3: Domain-Specific Rules

### Human Resources Module

**When building HR features:**

- ✅ Authentication: All routes protected by `requireRole('admin')` or `requireAuth()`
- ✅ Attendance: Track daily records, allow corrections (admin only)
- ✅ Leave: Support multiple leave types, track balances, require approvals
- ✅ Payroll: Validate period status, prevent double-posting, audit trail required
- ✅ Payslips: Generate from payroll data, support printing, archive storage
- ✅ Documents: Store employee documents, access control by role
- ✅ Sensitive data: Never log salary, deductions, tax info to console

**Example:**

```typescript
// ✅ Protected HR route
export default async function PayrollPage() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    redirect('/login');
  }

  const periods = await db.payrollPeriod.findMany();
  return <PayrollList periods={periods} />;
}
```

### Accounting Module

**When building Accounting features:**

- ✅ Journal entries: Require balanced debits/credits
- ✅ Posting: Once posted, entries are locked
- ✅ Reconciliation: Track reconciled vs. pending items
- ✅ Reports: Support multi-period comparisons
- ✅ Data integrity: All amount calculations rounded to 2 decimals

### Inventory Module

**When building Inventory features:**

- ✅ Stock tracking: Update on every movement (receipt, issue, adjustment)
- ✅ Valuations: Support FIFO, LIFO, weighted average methods
- ✅ Adjustments: Require supervisor approval for significant changes
- ✅ Movements: Complete audit trail (who, when, why)

---

## Quality Gate Checklist

**Before finalizing any implementation:**

### Code Quality

- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] All functions under 20 lines
- [ ] Single responsibility per function/component
- [ ] Error messages include enough context for debugging
- [ ] No dead code or commented sections

### Testing & Verification

- [ ] Build succeeds: `pnpm build`
- [ ] Linting passes: `pnpm lint`
- [ ] TypeScript check passes: `pnpm type-check`
- [ ] Test suite passes (if applicable): `pnpm test`

### Security & Data Protection

- [ ] No sensitive data in console logs
- [ ] Authentication checks present on protected routes
- [ ] Authorization checks present (role-based where needed)
- [ ] Input validation using Zod on all mutations

### Project Conventions

- [ ] Follows `.skills/react-forms/` for form patterns
- [ ] Follows `.skills/route-architecture/` for routes
- [ ] Follows `.skills/component-reuse/` (no duplicates)
- [ ] Follows `.skills/clean-code/` naming conventions
- [ ] Follows `.skills/api-integration/` for server actions/routes

---

## PR Submission Workflow

### Before Creating PR

1. **Run full quality checks:**

   ```bash
   pnpm lint
   pnpm type-check
   pnpm format:check
   pnpm build
   pnpm test
   ```

2. **Create feature branch:**

   ```bash
   git checkout -b feature/payroll-compute
   # or
   git checkout -b fix/attendance-calculation
   ```

3. **Commit with clear messages:**
   ```bash
   git commit -m "feat: implement payroll computation engine"
   # not "update code" or "fix bug"
   ```

### PR Template Usage

**Every PR MUST include:**

- ✅ Clear description of changes
- ✅ Link to relevant Jira ticket
- ✅ Link to Figma design (if UI changes)
- ✅ Type of change (Feature, Bug, Refactoring, etc.)
- ✅ Screenshots/videos (if UI changes)
- ✅ Completed QA checklist

**Template location**: `.github/pull_request_template.md`

### Review Expectations

- ✅ Code changes reviewed by at least one team member
- ✅ Design approval (if UI changes, by design team)
- ✅ All CI checks must pass (lint, build, tests)
- ✅ No merge conflicts with `main` branch

---

## Common Workflows

### Adding a New HR Feature (e.g., Leave Request Form)

**Step 1: Verify schema**

```bash
# Check if LeaveRequest model exists in schema.prisma
grep -n "model LeaveRequest" prisma/schema.prisma
```

**Step 2: Create Zod schema**

```typescript
// src/lib/schemas/leaveRequest.ts
const leaveRequestSchema = z.object({
  employeeId: z.string().cuid(),
  leaveType: z.enum(['annual', 'sick', 'unpaid']),
  startDate: z.date(),
  endDate: z.date(),
  reason: z.string().min(10),
})
```

**Step 3: Build form component**

```typescript
// src/components/hr/LeaveRequestForm.tsx
// Use Controller + leaveRequestSchema pattern
```

**Step 4: Create server action**

```typescript
// src/app/actions/leave.ts
export async function createLeaveRequest(input: unknown) {
  const validated = leaveRequestSchema.safeParse(input)
  // ... create, validate, save
}
```

**Step 5: Create route**

```typescript
// src/app/(app)/(user)/human-resource/leave/new/page.tsx
// Form submission calls server action
```

### Fixing a Bug

1. Create branch: `git checkout -b fix/payroll-rounding`
2. Reproduce the bug with a test
3. Find root cause and fix
4. Verify test passes
5. Commit: `git commit -m "fix: correct salary rounding to 2 decimals"`
6. Create PR with bug description and reproduction steps

---

## Escalation Path

**When you encounter blockers:**

1. **Missing data/schema**: Check `prisma/schema.prisma` and migrations
2. **API error**: Check `src/app/api/` and server action implementations
3. **Component error**: Check `src/components/` for similar patterns
4. **Design question**: Check Figma or ask for clarification before proceeding
5. **Architecture decision**: Document assumption and proceed (can be refined in review)

**Document all blockers clearly in PR description.**

---

## Related Documentation

- **Skills**: See `.skills/` directory for all coding standards
- **Architecture**: See `.skills/route-architecture/SKILL.md`
- **Forms**: See `.skills/react-forms/SKILL.md`
- **Components**: See `.skills/component-reuse/SKILL.md`
- **API patterns**: See `.skills/api-integration/SKILL.md`
- **Code style**: See `.skills/clean-code/SKILL.md`
