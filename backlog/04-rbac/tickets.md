---
list: 'RBAC'
list_id: '901615166754'
last_synced: '2026-06-08'
---

# RBAC Tickets

## Summary

| ID     | Title                                                | Status | Priority |
| ------ | ---------------------------------------------------- | ------ | -------- |
| RBAC-1 | AA Business Owner, ISBAT edit or delete a permission | TO DO  | normal   |

---

## Tickets

### [RBAC-1] — AA Business Owner, ISBAT edit or delete a permission

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

### SUBTASK (Frontend) — FE-RBAC-1

**Title:** FE: Edit and delete actions on permission rows
**Parent:** RBAC-1
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

### SUBTASK (Backend) — BE-RBAC-1

**Title:** BE: PATCH/DELETE /permissions/:id — already implemented
**Parent:** RBAC-1
**Contract:** `contracts/rbac/permissions.contract.md`

**Scope:**

- [ ] No backend work; endpoints exist and are functional
- [ ] Confirm deletion guard for in-use permissions is enforced

**Acceptance Criteria:**

- DELETE MUST be rejected when the permission is assigned to any role
