---
list: 'RBAC'
list_id: '901615166754'
last_synced: '2026-06-08'
---

# RBAC Tickets

## Summary

| ID      | Title                                                                           | Status | Priority |
| ------- | ------------------------------------------------------------------------------- | ------ | -------- |
| RBAC-01 | AA Employee, ISBAT have their access scoped to their assigned branch upon login | for QA | high     |

---

## Tickets

### [RBAC-01] — AA Employee, ISBAT have their access scoped to their assigned branch upon login

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3911v5

---

**Scenario:**
When an employee logs into the system, the JWT token issued by the backend should reflect their assigned branch. All subsequent API requests made under that session are scoped to that branch, restricting the employee from accessing data belonging to other branches. Employees not assigned to a specific branch (e.g. head-office staff) receive a `head` scope instead.

**Given:**

- The employee has an active account and valid credentials
- The employee's user record is linked to an employee profile with an assigned branch (or no branch for head-office scope)

**When:**

- The employee submits valid credentials to `POST /auth/login`

**Then:**
The system should:

- Issue a JWT token containing `branchId`, `branchName`, and `branchScope`
- Set `branchScope` to `"branch"` if the employee has an assigned branch, or `"head"` if not
- Return the user payload with branch details in the login response
- Reject API requests that attempt to access resources outside the employee's branch scope (enforced per endpoint via guards/decorators)

### Fields (Login Response)

- **branchId:** UUID of the assigned branch, or `null` for head-office employees
- **branchName:** Human-readable branch name, or `null`
- **branchScope:** `"branch"` | `"head"` — determines data access level for the session

### Buttons

- **Login**
  - Submits credentials; disabled while request is in flight

---

#### Empty States

- If the employee has no assigned branch, `branchId` and `branchName` are `null`; `branchScope` defaults to `"head"`

---

#### Post-Action Behavior

- On successful login, client receives access token with branch context embedded
- All subsequent authenticated requests carry branch scope automatically via the JWT guard

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-RBAC-01

**Title:** FE: Consume branch scope from login response and enforce branch-aware navigation
**Parent:** RBAC-01
**Contract:** `contracts/rbac/branch-scoped-login.contract.md`

**Scope:**

- [ ] Import/create TypeScript types matching login response shape (`branchId`, `branchName`, `branchScope`)
- [ ] Store branch context in session/auth store after login
- [ ] Gate module/route access based on `branchScope` value
- [ ] Display active branch name in the app header/sidebar where applicable
- [ ] Handle all error codes from the contract
- [ ] Add loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-RBAC-01-post-auth-login

**Title:** BE: POST /auth/login — embed branch scope in JWT payload
**Parent:** RBAC-01
**Contract:** `contracts/rbac/branch-scoped-login.contract.md`

**Scope:**

- [ ] Implement `POST /auth/login` — authenticate user and return JWT with branch context, returns `{ data: { accessToken, user: { branchId, branchName, branchScope, ... } } }`
- [ ] Request validation: `email` (required, valid email), `password` (required)
- [ ] Response shape matches `{ data, meta }` wrapper
- [ ] JWT strategy resolves `branchId` from `employee.branchId`, `branchName` from `employee.branch.name`, sets `branchScope` to `"branch"` or `"head"`
- [ ] Error responses: `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`
- [ ] Auth: public endpoint

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
- Validation errors MUST use exact contract error codes
- All required fields MUST be validated server-side
