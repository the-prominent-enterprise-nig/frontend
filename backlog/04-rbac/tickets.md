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
| RBAC-40 | AA Business Owner, ISBAT create and manage roles                                | for QA | high     |
| RBAC-41 | AA Business Owner, ISBAT assign permissions to a role                           | for QA | high     |
| RBAC-42 | AA Business Owner, ISBAT assign one or more roles to a user                     | for QA | high     |
| RBAC-43 | AA Business Owner, ISBAT edit or delete a permission                            | TO DO  | normal   |

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

---

### [RBAC-40] — AA Business Owner, ISBAT create and manage roles

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarum

---

**Scenario:**
Charter shared capability: "Role management". The owner defines roles (e.g. Branch Manager, Cashier, Accountant) with a hierarchy level and active flag, which become the unit for granting permissions and assigning users.

**Given:**

- The actor is authenticated with `admin:roles:manage` permission

**When:**

- The actor creates, renames, deactivates, or deletes a role in Settings → Roles

**Then:**
The system should:

- Save roles with name (unique per tenant), hierarchy level, and active flag
- Prevent deleting a role that has assigned users (require reassignment first)
- Show user count per role in the roles list

### Fields

- **Role name:** required, unique per tenant
- **Hierarchy level:** integer (admin > manager > staff)
- **Active:** boolean

### Buttons

- **Create Role** / **Save** / **Delete** (confirmation; blocked when users assigned)

---

#### Empty States

- "No custom roles yet" with default system roles listed

---

#### Post-Action Behavior

- Roles list refreshes; role available in user assignment pickers

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-RBAC-40

**Title:** FE: Roles list + create/edit forms on Settings → Roles
**Parent:** RBAC-40
**Contract:** `contracts/rbac/roles.contract.md`

**Scope:**

- [ ] Types match `/roles` response shapes
- [ ] Delete blocked with explanatory message when users assigned
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-RBAC-40-roles-crud

**Title:** BE: CRUD /roles — role lifecycle
**Parent:** RBAC-40
**Contract:** `contracts/rbac/roles.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH/DELETE /roles` — returns `{ data, meta }`
- [ ] Validation: unique name; delete guarded by user-assignment check
- [ ] Error responses: `ROLE_NOT_FOUND`, `ROLE_IN_USE`, `DUPLICATE_ROLE`
- [ ] Auth: bearer token + `admin:roles:manage`

**Acceptance Criteria:**

- Role deletion MUST be rejected while users are assigned

---

### [RBAC-41] — AA Business Owner, ISBAT assign permissions to a role

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarv6

---

**Scenario:**
Charter shared capability: "Permission management". Each role carries a set of `module:resource:action` permissions; the owner edits a role's permission set via the matrix on Settings → Permissions, and changes apply to every user holding the role.

**Given:**

- A role exists
- The actor has `admin:permissions:manage` permission

**When:**

- The actor toggles permissions for the role and saves

**Then:**
The system should:

- Persist the role's permission set (grant/revoke per `module:resource:action`)
- Group the matrix by module → resource → action for scanability
- Apply changes to all users with that role on next token refresh
- Prevent removing the owner role's user-management permissions (no lock-out)

### Sections

- **Permission matrix:** module groups with per-action checkboxes; select-all per resource

### Buttons

- **Save Permissions**
  - Disabled until a change is made; shows count of pending changes

---

#### Empty States

- A role with no permissions shows a warning banner ("users with this role can log in but see nothing")

---

#### Post-Action Behavior

- Success toast; matrix reflects saved state; audit entry written

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-RBAC-41

**Title:** FE: Permission matrix per role with grouped toggles
**Parent:** RBAC-41
**Contract:** `contracts/rbac/role-permissions.contract.md`

**Scope:**

- [ ] Types match `/roles/:id/permissions` response shapes
- [ ] Grouped matrix with select-all per resource
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Pending-change count MUST match actual diff sent to the API

---

### SUBTASK (Backend) — BE-RBAC-41-role-permissions

**Title:** BE: PUT /roles/:id/permissions — replace permission set
**Parent:** RBAC-41
**Contract:** `contracts/rbac/role-permissions.contract.md`

**Scope:**

- [ ] `PUT /roles/:id/permissions` — replaces set, returns `{ data, meta }`
- [ ] Validation: permission keys exist in registry; lock-out guard for owner role
- [ ] Error responses: `ROLE_NOT_FOUND`, `UNKNOWN_PERMISSION`, `LOCKOUT_BLOCKED`
- [ ] Auth: bearer token + `admin:permissions:manage`

**Acceptance Criteria:**

- Owner role MUST always retain user/role management permissions

---

### [RBAC-42] — AA Business Owner, ISBAT assign one or more roles to a user

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aarvy

---

**Scenario:**
The owner grants or changes a user's roles (e.g. promote a Cashier to Branch Manager). A user can hold multiple roles; effective permissions are the union of all held roles.

**Given:**

- A user and at least one role exist
- The actor has `admin:users:update` permission

**When:**

- The actor edits the user's roles from the user detail and saves

**Then:**
The system should:

- Replace the user's role set via the UserRole association
- Compute effective permissions as the union of all assigned roles
- Apply the change on next login/token refresh
- Require at least one role per active user

### Fields

- **Roles:** multi-select of active roles

### Buttons

- **Save Roles**
  - Disabled when selection is empty

---

#### Empty States

- N/A (at least one role enforced)

---

#### Post-Action Behavior

- Role chips update on the user row; audit entry written

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-RBAC-42

**Title:** FE: Role multi-select on user detail with chips
**Parent:** RBAC-42
**Contract:** `contracts/rbac/user-roles.contract.md`

**Scope:**

- [ ] Types match `/users/:id/roles` response shapes
- [ ] Empty-selection guard with message
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-RBAC-42-user-roles

**Title:** BE: PUT /users/:id/roles — replace role set
**Parent:** RBAC-42
**Contract:** `contracts/rbac/user-roles.contract.md`

**Scope:**

- [ ] `PUT /users/:id/roles` — replaces UserRole set, returns `{ data, meta }`
- [ ] Validation: roles exist and active; min one role
- [ ] Error responses: `USER_NOT_FOUND`, `ROLE_NOT_FOUND`, `MIN_ONE_ROLE`
- [ ] Auth: bearer token + `admin:users:update`

**Acceptance Criteria:**

- Effective permissions MUST be the union of all assigned roles

---

### [RBAC-43] — AA Business Owner, ISBAT edit or delete a permission

**Status:** TO DO
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3abbxp

---

**Scenario:**
The Business Owner or Admin needs to maintain the permission registry — correcting a permission's key or label, or removing an obsolete permission that is no longer assigned to any role.

**Given:**

- The actor is authenticated with `admin:permissions:manage` permission
- At least one permission exists

**When:**

- The actor edits a permission's display name or `module:resource:action` key, or deletes a permission

**Then:**
The system should:

- Allow editing a permission's display name and module:resource:action key
- Prevent deletion of a permission currently assigned to one or more roles (require removal first, with explanatory message)
- Reflect changes immediately in the permission matrix on Settings → Permissions

### Fields

- **Display name:** required
- **Permission key:** `module:resource:action` format, required, unique

### Buttons

- **Edit** — inline form or modal
- **Delete** — blocked when assigned to roles, with explanatory message; confirmation required otherwise

---

#### Empty States

- N/A

---

#### Post-Action Behavior

- Permission list refreshes; matrix reflects updated key/name

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-RBAC-43

**Title:** FE: Edit and delete actions on permission rows
**Parent:** RBAC-43
**Contract:** `contracts/rbac/permissions.contract.md`

**Scope:**

- [ ] Types match `/permissions/:id` response shapes
- [ ] Edit modal/inline form with validation
- [ ] Delete blocked with message when permission is in use
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Delete MUST be blocked when the permission is assigned to any role

---

### SUBTASK (Backend) — BE-RBAC-43

**Title:** BE: PATCH/DELETE /permissions/:id — already implemented
**Parent:** RBAC-43
**Contract:** `contracts/rbac/permissions.contract.md`

**Scope:**

- [ ] No backend work; endpoints exist and are functional
- [ ] Confirm deletion guard for in-use permissions is enforced

**Acceptance Criteria:**

- DELETE MUST be rejected when the permission is assigned to any role
