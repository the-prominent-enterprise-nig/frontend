---
list: '10 - CRM'
list_id: '901615166764'
last_synced: '2026-06-10'
---

# CRM Tickets

## Summary

| ID     | Title                                                                                   | Status | Priority |
| ------ | --------------------------------------------------------------------------------------- | ------ | -------- |
| CRM-23 | AA Sales Rep, ISBAT create and manage customer profiles                                 | for QA | high     |
| CRM-24 | AA Sales Rep, ISBAT log interactions against a customer or lead                         | for QA | high     |
| CRM-25 | AA Sales Rep, ISBAT create and manage leads with source and assignee                    | for QA | high     |
| CRM-26 | AA Sales Manager, ISBAT configure pipeline stages with won/lost definitions             | for QA | high     |
| CRM-27 | AA Sales Rep, ISBAT move leads through the pipeline on a Kanban board                   | for QA | high     |
| CRM-28 | AA Sales Rep, ISBAT convert a qualified lead into a customer                            | for QA | high     |
| CRM-29 | AA Sales Rep, ISBAT schedule follow-up reminders with due dates and completion tracking | for QA | high     |
| CRM-30 | AA Sales Manager, ISBAT create rule-based customer segments                             | for QA | normal   |
| CRM-31 | AA Sales Rep, ISBAT view a customer 360 view with interactions, reminders, and leads    | for QA | high     |

---

## Tickets

### [CRM-23] — AA Sales Rep, ISBAT create and manage customer profiles

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat2z

---

**Scenario:**
A sales rep maintains customer master records (individual or business) so that sales, receivables, and engagement activity can be tracked against a single profile. Profiles capture contact details, tax status, address, credit limit, and source channel.

**Given:**

- The user is authenticated with `crm:customers:create` / `crm:customers:update` permission
- The CRM module is enabled for the tenant

**When:**

- The user opens CRM → Customers and creates or edits a customer

**Then:**
The system should:

- Save the customer with type (individual/business), name, contact details, address, tax status, credit limit, and source channel
- Show the customer in the searchable customer list immediately
- Support soft delete (archived customers excluded from default list)
- Validate required fields inline before submission

### Fields

- **Type:** individual | business (required)
- **Name / Company name:** required, max 120 chars
- **Email / Phone:** at least one required; email format validated
- **Address:** optional structured address
- **Credit limit:** optional, numeric ≥ 0
- **Source channel:** POS walk-in | sales | lead | online

### Buttons

- **Save Customer**
  - Persists the profile; disabled while submitting or when required fields are invalid
- **Archive**
  - Soft-deletes with confirmation dialog

---

#### Empty States

- Customer list with no records shows "No customers yet" with a Create Customer call-to-action

---

#### Post-Action Behavior

- Success toast; list refreshes; detail panel opens for the new customer

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-23

**Title:** FE: Customer list + create/edit form
**Parent:** CRM-23
**Contract:** `contracts/crm/customers.contract.md`

**Scope:**

- [ ] Types match `/crm/customers` response shapes
- [ ] Customer list with search and filters at `/crm/customers`
- [ ] Create/edit form with inline validation per AC
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-23-customers-crud

**Title:** BE: CRUD /crm/customers — customer master
**Parent:** CRM-23
**Contract:** `contracts/crm/customers.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH/DELETE /crm/customers` — CRUD with soft delete, returns `{ data, meta }`
- [ ] Request validation: type, name, email format, creditLimit ≥ 0
- [ ] Error responses: `CUSTOMER_NOT_FOUND`, `VALIDATION_ERROR`, `DUPLICATE_EMAIL`
- [ ] Auth: bearer token + `crm:customers:*` permissions

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
- All required fields MUST be validated server-side

---

### [CRM-24] — AA Sales Rep, ISBAT log interactions against a customer or lead

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat42

---

**Scenario:**
A sales rep records each touchpoint (call, email, meeting, visit, message) with a customer or lead so the team has a shared communication history.

**Given:**

- The user is authenticated with `crm:interactions:create` permission
- A customer or lead record exists

**When:**

- The user logs an interaction from the customer/lead detail page

**Then:**
The system should:

- Save the interaction with type, summary, outcome, timestamp, and linked customer or lead
- Display interactions newest-first on the related record
- Allow filtering interactions by type and date range

### Fields

- **Type:** call | email | meeting | visit | message (required)
- **Summary:** required, max 500 chars
- **Outcome:** optional short text
- **Date/time:** defaults to now, editable

### Buttons

- **Log Interaction**
  - Persists the entry; disabled while submitting

---

#### Empty States

- "No interactions logged yet" on records with no history

---

#### Post-Action Behavior

- Interaction appears at the top of the timeline without full page reload

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-24

**Title:** FE: Interaction log form + timeline on customer/lead detail
**Parent:** CRM-24
**Contract:** `contracts/crm/interactions.contract.md`

**Scope:**

- [ ] Types match `/crm/interactions` response shapes
- [ ] Timeline component with type filter
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-24-interactions

**Title:** BE: POST/GET /crm/interactions — log and query interactions
**Parent:** CRM-24
**Contract:** `contracts/crm/interactions.contract.md`

**Scope:**

- [ ] `POST /crm/interactions`, `GET /crm/interactions?customerId|leadId` — returns `{ data, meta }`
- [ ] Validation: type enum, summary required, exactly one of customerId/leadId
- [ ] Error responses: `TARGET_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `crm:interactions:*`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
- All required fields MUST be validated server-side

---

### [CRM-25] — AA Sales Rep, ISBAT create and manage leads with source and assignee

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat4r

---

**Scenario:**
A sales rep captures prospective customers as leads with contact info, source, estimated value, and an assigned owner, so the pipeline reflects all open opportunities.

**Given:**

- The user is authenticated with `crm:leads:create` permission
- Pipeline stages are configured

**When:**

- The user creates a lead from CRM → Leads → New

**Then:**
The system should:

- Save the lead with name, company, contact details, source, estimated value, assignee, and initial pipeline stage
- Show the lead in the lead list and on the pipeline board
- Support edit and archive with status workflow (active → won/lost/archived)

### Fields

- **First/Last name:** required
- **Company:** optional
- **Email / Phone:** at least one required
- **Estimated value:** optional, numeric ≥ 0
- **Assignee:** user picker, defaults to creator
- **Stage:** defaults to first pipeline stage

### Buttons

- **Create Lead**
  - Persists; disabled while invalid or submitting

---

#### Empty States

- "No leads yet" with New Lead call-to-action

---

#### Post-Action Behavior

- Redirect to lead detail; success toast

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-25

**Title:** FE: Lead list, create/edit forms, detail page
**Parent:** CRM-25
**Contract:** `contracts/crm/leads.contract.md`

**Scope:**

- [ ] Types match `/crm/leads` response shapes
- [ ] List + `/crm/leads/new` + `[id]/edit` pages wired
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-25-leads-crud

**Title:** BE: CRUD /crm/leads — lead lifecycle
**Parent:** CRM-25
**Contract:** `contracts/crm/leads.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH/DELETE /crm/leads` — returns `{ data, meta }`
- [ ] Validation: names required, contact presence, estimatedValue ≥ 0, stage exists
- [ ] Error responses: `LEAD_NOT_FOUND`, `STAGE_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `crm:leads:*`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
- All required fields MUST be validated server-side

---

### [CRM-26] — AA Sales Manager, ISBAT configure pipeline stages with won/lost definitions

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat5f

---

**Scenario:**
A sales manager defines the ordered stages of the sales pipeline and marks which stages represent won and lost outcomes, so lead progression and conversion reporting are consistent.

**Given:**

- The user is authenticated with `crm:pipeline:manage` permission

**When:**

- The user creates, reorders, renames, or deletes stages in CRM settings

**Then:**
The system should:

- Persist stages with name, order, and won/lost flags
- Enforce exactly one won stage and at least one lost stage flagging rule (or warn when missing)
- Prevent deleting a stage that has leads (require reassignment)

### Fields

- **Stage name:** required, unique per tenant
- **Order:** drag-to-reorder
- **Is won / Is lost:** boolean flags

### Buttons

- **Add Stage** / **Save Order**
  - Persist changes; disabled while submitting

---

#### Empty States

- Default stages offered when no stages exist

---

#### Post-Action Behavior

- Pipeline board re-renders with new column layout

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-26

**Title:** FE: Pipeline stage settings UI
**Parent:** CRM-26
**Contract:** `contracts/crm/pipeline-stages.contract.md`

**Scope:**

- [ ] Types match `/crm/pipeline-stages` response shapes
- [ ] Stage list with drag reorder and won/lost toggles
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-26-pipeline-stages

**Title:** BE: CRUD /crm/pipeline-stages — ordered stages with flags
**Parent:** CRM-26
**Contract:** `contracts/crm/pipeline-stages.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH/DELETE /crm/pipeline-stages` — returns `{ data, meta }`
- [ ] Validation: unique name, order integer, flag rules
- [ ] Error responses: `STAGE_IN_USE`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `crm:pipeline:manage`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
- All required fields MUST be validated server-side

---

### [CRM-27] — AA Sales Rep, ISBAT move leads through the pipeline on a Kanban board

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat66

---

**Scenario:**
A sales rep drags lead cards across pipeline stage columns to reflect deal progress; moving into a won/lost stage records the outcome.

**Given:**

- Pipeline stages are configured
- At least one active lead exists

**When:**

- The user drags a lead card to another stage column on CRM → Pipeline

**Then:**
The system should:

- Persist the stage change immediately (optimistic update with rollback on failure)
- Show per-column count and total estimated value
- Prompt for confirmation/outcome details when dropping into a won or lost stage

### Filters

- **Assignee:** filter board by owner
- **Search:** by lead name/company

### Buttons

- **Card → detail**
  - Clicking a card opens lead detail

---

#### Empty States

- Columns with no leads show a subtle "Drop leads here" placeholder

---

#### Post-Action Behavior

- Stage history recorded; board totals update in place

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-27

**Title:** FE: Pipeline Kanban with drag-drop (dnd-kit)
**Parent:** CRM-27
**Contract:** `contracts/crm/pipeline-board.contract.md`

**Scope:**

- [ ] Types match `/crm/leads` stage-move response shape
- [ ] Optimistic drag-drop with rollback toast on failure
- [ ] Handle all error codes from the contract
- [ ] Loading/empty states per story AC

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-27-stage-move

**Title:** BE: PATCH /crm/leads/:id/stage — move lead between stages
**Parent:** CRM-27
**Contract:** `contracts/crm/pipeline-board.contract.md`

**Scope:**

- [ ] `PATCH /crm/leads/:id/stage` — validates stage exists, records history, returns `{ data, meta }`
- [ ] Error responses: `LEAD_NOT_FOUND`, `STAGE_NOT_FOUND`
- [ ] Auth: bearer token + `crm:leads:update`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly

---

### [CRM-28] — AA Sales Rep, ISBAT convert a qualified lead into a customer

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat6t

---

**Scenario:**
When a lead is won, the rep converts it into a customer record so receivables and POS activity can be tracked against it; the lead history stays linked.

**Given:**

- An active lead exists with contact details

**When:**

- The user clicks Convert to Customer on the lead detail

**Then:**
The system should:

- Create a customer pre-filled from lead fields (name, company, email, phone)
- Link the originating lead to the new customer (visible on customer 360)
- Mark the lead as converted/won and remove it from active pipeline
- Prevent double conversion of the same lead

### Buttons

- **Convert to Customer**
  - Opens pre-filled customer form; on save performs the conversion atomically

---

#### Empty States

- N/A (action on existing record)

---

#### Post-Action Behavior

- Redirect to the new customer profile; success toast with link back to lead

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-28

**Title:** FE: Convert-lead flow with pre-filled customer form
**Parent:** CRM-28
**Contract:** `contracts/crm/lead-conversion.contract.md`

**Scope:**

- [ ] Types match conversion response shape
- [ ] Disable convert button for already-converted leads
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-28-convert

**Title:** BE: POST /crm/leads/:id/convert — lead to customer
**Parent:** CRM-28
**Contract:** `contracts/crm/lead-conversion.contract.md`

**Scope:**

- [ ] `POST /crm/leads/:id/convert` — creates customer, links lead, returns `{ data, meta }`
- [ ] Idempotency: second call returns `LEAD_ALREADY_CONVERTED`
- [ ] Error responses: `LEAD_NOT_FOUND`, `LEAD_ALREADY_CONVERTED`
- [ ] Auth: bearer token + `crm:leads:update`

**Acceptance Criteria:**

- Conversion MUST be transactional (customer create + lead update atomic)

---

### [CRM-29] — AA Sales Rep, ISBAT schedule follow-up reminders with due dates and completion tracking

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat7d

---

**Scenario:**
A rep schedules follow-up tasks against customers or leads with a due date and assignee; overdue reminders are highlighted so nothing slips.

**Given:**

- A customer or lead exists
- The user has `crm:reminders:create` permission

**When:**

- The user creates a reminder from a record or CRM → Reminders

**Then:**
The system should:

- Save reminder with title, due date, assignee, and linked record
- Track status: pending → completed / cancelled; auto-flag overdue past due date
- List reminders filterable by status and assignee

### Fields

- **Title:** required, max 200 chars
- **Due date:** required, today or future on creation
- **Assignee:** defaults to creator

### Buttons

- **Create Reminder** / **Mark Complete**
  - Complete records completion timestamp

---

#### Empty States

- "No reminders — schedule a follow-up" with create call-to-action

---

#### Post-Action Behavior

- Completed reminders move out of the pending list; overdue badge clears

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-29

**Title:** FE: Reminder list + create/complete flows
**Parent:** CRM-29
**Contract:** `contracts/crm/reminders.contract.md`

**Scope:**

- [ ] Types match `/crm/reminders` response shapes
- [ ] Overdue highlighting and status filters
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly
- Error handling MUST cover all contract error codes

---

### SUBTASK (Backend) — BE-CRM-29-reminders

**Title:** BE: CRUD /crm/reminders — follow-ups with overdue detection
**Parent:** CRM-29
**Contract:** `contracts/crm/reminders.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH /crm/reminders` (+ `/complete`) — returns `{ data, meta }`
- [ ] Validation: title required, dueDate valid date
- [ ] Error responses: `REMINDER_NOT_FOUND`, `VALIDATION_ERROR`
- [ ] Auth: bearer token + `crm:reminders:*`

**Acceptance Criteria:**

- Overdue computation MUST be server-side (status or derived flag)

---

### [CRM-30] — AA Sales Manager, ISBAT create rule-based customer segments

**Status:** for QA
**Priority:** normal
**ClickUp:** https://app.clickup.com/t/86d3aat7v

---

**Scenario:**
A sales manager groups customers into segments by rules (e.g. source channel, type, activity) for targeted campaigns and reporting; member counts refresh on demand.

**Given:**

- Customers exist
- The user has `crm:segments:manage` permission

**When:**

- The user defines a segment with one or more rules and saves it

**Then:**
The system should:

- Persist the segment with name and rule definition
- Compute and display member count; support manual refresh
- Show segment badges on matching customer profiles

### Fields

- **Segment name:** required, unique
- **Rules:** field + operator + value rows, AND-combined

### Buttons

- **Save Segment** / **Refresh Members**

---

#### Empty States

- "No segments defined" with create call-to-action

---

#### Post-Action Behavior

- Member count updates after refresh; toast on completion

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-30

**Title:** FE: Segment builder UI with rule rows
**Parent:** CRM-30
**Contract:** `contracts/crm/segments.contract.md`

**Scope:**

- [ ] Types match `/crm/customer-segment` response shapes
- [ ] Rule-row builder with validation
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-CRM-30-segments

**Title:** BE: CRUD /crm/customer-segment — rules + member refresh
**Parent:** CRM-30
**Contract:** `contracts/crm/segments.contract.md`

**Scope:**

- [ ] `POST/GET/PATCH/DELETE /crm/customer-segment` (+ `/refresh`) — returns `{ data, meta }`
- [ ] Validation: rule schema, unique name
- [ ] Error responses: `SEGMENT_NOT_FOUND`, `INVALID_RULE`
- [ ] Auth: bearer token + `crm:segments:manage`

**Acceptance Criteria:**

- Rule evaluation MUST be server-side and deterministic

---

### [CRM-31] — AA Sales Rep, ISBAT view a customer 360 view with interactions, reminders, and leads

**Status:** for QA
**Priority:** high
**ClickUp:** https://app.clickup.com/t/86d3aat8g

---

**Scenario:**
Opening a customer profile shows a unified 360 panel — profile details, recent interactions, active reminders, and related leads — so a rep gets full context before any engagement.

**Given:**

- A customer exists with related activity

**When:**

- The user opens CRM → Customers → [customer]

**Then:**
The system should:

- Display profile summary, recent interactions (latest 10), active reminders, and related leads in one view
- Link each section to its full list filtered by this customer
- Load sections independently (skeleton per section, no full-page block)

### Sections

- **Profile:** contact, type, credit limit, source
- **Interactions:** newest-first timeline
- **Reminders:** pending + overdue first
- **Related leads:** with stage badges

### Buttons

- **Log Interaction / Add Reminder**
  - Quick actions pre-linked to this customer

---

#### Empty States

- Each section shows its own empty message; profile always renders

---

#### Post-Action Behavior

- Quick actions refresh only the affected section

---

#### Figma Reference

- [PLACEHOLDER: add Figma node]

---

### SUBTASK (Frontend) — FE-CRM-31

**Title:** FE: Customer 360 detail page with sectioned loading
**Parent:** CRM-31
**Contract:** `contracts/crm/customer-360.contract.md`

**Scope:**

- [ ] Types match `/crm/customers/:id/360` response shape
- [ ] Per-section skeletons and empty states
- [ ] Handle all error codes from the contract

**Acceptance Criteria:**

- Types MUST match API response shapes exactly

---

### SUBTASK (Backend) — BE-CRM-31-customer-360

**Title:** BE: GET /crm/customers/:id/360 — unified view payload
**Parent:** CRM-31
**Contract:** `contracts/crm/customer-360.contract.md`

**Scope:**

- [ ] `GET /crm/customers/:id/360` — profile + recent interactions + active reminders + related leads, returns `{ data, meta }`
- [ ] Error responses: `CUSTOMER_NOT_FOUND`
- [ ] Auth: bearer token + `crm:customers:read`

**Acceptance Criteria:**

- Response JSON MUST match contract response shape exactly
