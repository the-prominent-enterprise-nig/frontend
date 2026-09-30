import { z } from 'zod'
import { DOWN_PAYMENT_FLOOR_RATE, DOWN_PAYMENT_FLOOR_LABEL } from '@/src/libs/constants/financing'

export const CreditApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_investigation',
  'pending_approval',
  'approved',
  'partially_approved',
  'declined',
  'cancelled',
])
export type CreditApplicationStatus = z.infer<typeof CreditApplicationStatusSchema>

export const CREDIT_APPLICATION_STATUS_LABELS: Record<CreditApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_investigation: 'Under Investigation',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  partially_approved: 'Partially Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export const CREDIT_APPLICATION_STATUS_COLORS: Record<CreditApplicationStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-100 text-blue-700',
  under_investigation: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  partially_approved: 'bg-orange-100 text-orange-700',
  declined: 'bg-red-100 text-red-600',
  cancelled: 'bg-red-100 text-red-600',
}

/**
 * Scenario 60 Part 6 — an approved application with no applicant ID on file
 * is "approved but incomplete": still usable for a sale (the client's
 * explicit requirement — nothing here gates anything), but visibly not
 * finished. Derived, never stored, so it corrects itself the moment the ID
 * is attached.
 *
 * `hasApplicantId === false` is checked explicitly rather than falsy: only
 * findAll() sets the flag, so `undefined` means "this caller doesn't know"
 * (the detail endpoint, which loads documents separately) and must fall
 * through to the plain Approved badge rather than wrongly claiming the ID
 * is missing.
 */
export function creditApplicationBadge(app: {
  status: CreditApplicationStatus
  hasApplicantId?: boolean
}): { label: string; colorClassName: string } {
  if (app.status === 'approved' && app.hasApplicantId === false) {
    return { label: 'Approved — ID pending', colorClassName: 'bg-amber-100 text-amber-700' }
  }
  return {
    label: CREDIT_APPLICATION_STATUS_LABELS[app.status],
    colorClassName: CREDIT_APPLICATION_STATUS_COLORS[app.status],
  }
}

// Scenario 29 POS-02 — per-item status, independent of the application's
// own status above.
export const CreditApplicationItemStatusSchema = z.enum(['pending', 'approved', 'declined'])
export type CreditApplicationItemStatus = z.infer<typeof CreditApplicationItemStatusSchema>

export const CREDIT_APPLICATION_ITEM_STATUS_LABELS: Record<CreditApplicationItemStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
}

export const CREDIT_APPLICATION_ITEM_STATUS_COLORS: Record<CreditApplicationItemStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
}

export const CreditApplicationDocumentTypeSchema = z.enum([
  'applicant_id',
  'applicant_income_proof',
  'applicant_expense_proof',
  'co_maker_id',
  'co_maker_income_proof',
  'other',
])
export type CreditApplicationDocumentType = z.infer<typeof CreditApplicationDocumentTypeSchema>

export const CREDIT_APPLICATION_DOCUMENT_TYPE_LABELS: Record<
  CreditApplicationDocumentType,
  string
> = {
  applicant_id: 'Applicant ID',
  applicant_income_proof: 'Applicant Income Proof',
  applicant_expense_proof: 'Applicant Expense Proof',
  co_maker_id: 'Co-Maker ID',
  co_maker_income_proof: 'Co-Maker Income Proof',
  other: 'Other',
}

export const CreditInvestigationOutcomeSchema = z.enum(['recommend_approve', 'recommend_decline'])
export type CreditInvestigationOutcome = z.infer<typeof CreditInvestigationOutcomeSchema>

export const CREDIT_INVESTIGATION_OUTCOME_LABELS: Record<CreditInvestigationOutcome, string> = {
  recommend_approve: 'Recommend Approve',
  recommend_decline: 'Recommend Decline',
}

export const CREDIT_INVESTIGATION_OUTCOME_COLORS: Record<CreditInvestigationOutcome, string> = {
  recommend_approve: 'bg-green-100 text-green-700',
  recommend_decline: 'bg-red-100 text-red-600',
}

export const RecordCreditInvestigationFormSchema = z.object({
  affordabilityOutcome: CreditInvestigationOutcomeSchema,
  notes: z.string().max(4000).optional(),
})
export type RecordCreditInvestigationFormValues = z.infer<
  typeof RecordCreditInvestigationFormSchema
>

export interface CreditInvestigation {
  id: string
  creditApplicationId: string
  affordabilityOutcome: CreditInvestigationOutcome
  notes?: string | null
  investigatedById: string
  investigatedAt: string
  createdAt: string
  updatedAt: string
}

// Sentinel `coMakerId` value meaning "fill in a brand-new co-maker below"
// instead of picking one already on file for the applicant.
export const NEW_CO_MAKER_VALUE = '__new__'

const CreateCreditApplicationBaseSchema = z.object({
  // Audit-only — not shown as a form field. Sent when the actor is
  // branch-locked; otherwise omitted and the backend defaults it to the
  // enterprise's main branch (see CreditApplicationService.create()).
  branchId: z.string().optional(),
  applicantCustomerId: z.string().min(1, 'Applicant is required'),
  // Applicant contact — prefilled from the selected customer once picked,
  // and editable. These aren't part of the credit application payload:
  // NewCreditApplicationForm's submit handler diffs them against what
  // was loaded and, if changed, saves them to the customer's real record
  // via a separate PATCH /crm/customers/:id call before creating/updating
  // the application itself.
  applicantPhone: z.string().max(50).optional().or(z.literal('')),
  applicantEmail: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  // Scenario 60 item 27 — the rest of the mockup's CUSTOMER PROFILE block.
  // All form-only: they are seeded from the applicant's customer record and
  // PATCHed back to it on submit, never sent in the credit application
  // payload. Nothing is required — the mockup marks none of it so, and a
  // returning customer captured before these existed has none on file.
  applicantFirstName: z.string().max(150).optional().or(z.literal('')),
  applicantMiddleName: z.string().max(150).optional().or(z.literal('')),
  applicantLastName: z.string().max(150).optional().or(z.literal('')),
  applicantAltPhone: z.string().max(50).optional().or(z.literal('')),
  applicantBirthday: z.string().optional().or(z.literal('')),
  applicantCivilStatus: z
    .enum(['Single', 'Married', 'Widowed', 'Separated'])
    .optional()
    .or(z.literal('')),
  applicantGender: z.enum(['M', 'F']).optional().or(z.literal('')),
  applicantFacebookName: z.string().max(255).optional().or(z.literal('')),
  /** Employer, company name or own business name depending on the type
   *  below — all three are `Customer.companyName`. */
  applicantEmployer: z.string().max(255).optional().or(z.literal('')),
  applicantCustomerType: z
    .enum(['individual', 'self_employed', 'business', 'employee'])
    .optional()
    .or(z.literal('')),
  applicantAddress: z.string().max(1000).optional().or(z.literal('')),
  applicantBarangayCode: z.string().max(20).optional().or(z.literal('')),
  // Holds an existing co-maker's id, the NEW_CO_MAKER_VALUE sentinel (fill
  // in a brand-new co-maker below), or '' (no co-maker).
  coMakerId: z.string().optional(),
  // Editable details for whichever existing co-maker is selected above —
  // same "diff and PATCH separately" treatment as applicantPhone/Email,
  // via customersApi.updateCoMaker().
  //
  // Name and relationship were added 2026-09-18: previously only phone and
  // email were editable, so a co-maker saved with a misspelled name or the
  // wrong relationship could not be corrected anywhere in the credit
  // application UI.
  //
  // Split into first/last to match the CRM create-customer form (client
  // request, 2026-09-19). CoMaker stores a single `name` column, so these
  // are seeded by splitting the stored name on its first space and rejoined
  // with a single space on save — the same fallback CustomerForm already
  // uses for records predating its own firstName/lastName columns. Lossless
  // on round-trip apart from collapsing repeated whitespace.
  coMakerFirstName: z.string().max(120).optional().or(z.literal('')),
  coMakerLastName: z.string().max(120).optional().or(z.literal('')),
  coMakerRelationship: z.string().max(100).optional().or(z.literal('')),
  coMakerContactNumber: z.string().max(50).optional().or(z.literal('')),
  coMakerEmail: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  // Only used when coMakerId === NEW_CO_MAKER_VALUE — creates a co-maker on
  // the applicant's profile via customersApi.addCoMaker() before the
  // application itself is submitted.
  // First/last are captured separately here and joined into the single
  // CoMaker.name column on submit — the table has no split name columns.
  newCoMakerFirstName: z.string().max(120).optional().or(z.literal('')),
  newCoMakerLastName: z.string().max(120).optional().or(z.literal('')),
  newCoMakerRelationship: z.string().max(100).optional().or(z.literal('')),
  newCoMakerContactNumber: z.string().max(50).optional().or(z.literal('')),
  newCoMakerEmail: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  // Scenario 60 item 27 — the paper form's CHARACTER REFERENCES block, three
  // fixed rows so the ERP record lines up with "Reference 1/2/3" on the
  // scan. Rows are kept in the form even when blank; the submit strips the
  // empty ones, so a transcriber can fill row 3 without touching row 2.
  //
  // Nothing is required: the mockup marks the minimum as "subject to NIG
  // policy", which has not been stated. What IS enforced is that a row is
  // all-or-nothing — a name with no number is not a usable reference, and
  // the backend requires the number when a row exists at all.
  // Scenario 60 item 27 — the mockup's RELATED PEOPLE block. Rows are added
  // as needed with the role picked per row (client, 2026-09-30: "same
  // behavior as the character references"), rather than three fixed rows
  // for spouse/father/mother — most applications name one or two people,
  // and three pre-labelled empty rows read as three things left undone.
  //
  // Co-maker is NOT a role here: it keeps its own section, backed by the
  // existing CoMaker record that promissory notes and the checkout gate
  // reference.
  relatedPeople: z
    .array(
      z.object({
        role: z.enum(['spouse', 'father', 'mother']).optional().or(z.literal('')),
        firstName: z.string().max(150).optional().or(z.literal('')),
        lastName: z.string().max(150).optional().or(z.literal('')),
        mobileNumber: z.string().max(50).optional().or(z.literal('')),
      })
    )
    .optional(),

  // Scenario 60 item 27 — PROPOSED PURCHASE AND INSTALLMENT. Transcribed
  // from paper, not derived: the mockup marks most of this block "read only
  // from POS draft", but until a draft/quote entity exists the honest shape
  // is a typed value.
  lcp: z.string().optional().or(z.literal('')),
  downPaymentCollection: z.enum(['online', 'branch', 'delivery']).optional().or(z.literal('')),
  firstDueDate: z.string().optional().or(z.literal('')),
  ppdRebate: z.string().optional().or(z.literal('')),
  posDraftReference: z.string().max(100).optional().or(z.literal('')),

  // Scenario 60 item 27 — PAPER RECORD AND CREDIT DECISION. The decision
  // itself stays with decideItems(); these are the transcription facts.
  paperFormConfirmed: z.boolean().optional(),
  applicantIsUnitUser: z.enum(['yes', 'no']).optional().or(z.literal('')),

  references: z
    .array(
      z.object({
        name: z.string().max(255).optional().or(z.literal('')),
        relationship: z.string().max(100).optional().or(z.literal('')),
        mobileNumber: z.string().max(50).optional().or(z.literal('')),
      })
    )
    .optional(),
  // An application can cover a bundle of models (2026-08-15, second pass) —
  // checkout enforces an exact match against the sale's installment lines.
  // estimatedPrice is the flat catalog price the item combobox's search
  // result carries, kept in form state (not component state) so the
  // financing preview below can sum it reactively via watch('items') and
  // stay index-safe across add/remove. Also sent to the backend (mapped to
  // the DTO's unitPrice in create-application.ts/update-application.ts) —
  // the backend now trusts this client-supplied price over its own Price
  // List resolution, so the down payment matches the price actually shown
  // here instead of a possibly-divergent Price Use lookup.
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        // Stays a strict number: every writer must Number() first, because
        // the API serializes Decimal as a STRING ("10590.27") and feeding
        // that in made this reject — invisibly, since the failure is nested
        // inside an array, which is what left the edit modal's Save button
        // looking dead. z.coerce would hide that but widens the schema's
        // input type to unknown, breaking useForm's generic.
        estimatedPrice: z.number().optional(),
        // Also client-only. The combobox shows a label, not an id, and it
        // has no way to look one up from an id alone — so without this a
        // restored draft kept its itemId but rendered an empty picker, and
        // the item looked lost. Stripped server-side by the DTO whitelist.
        itemLabel: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
  itemDescription: z.string().max(500).optional(),
  // 2026-09-18 client request — captured at intake so the applicant and the
  // branch both see the real DP/monthly/total-payable numbers before
  // submission, not just the raw item price. Both optional: an application
  // can still be raised with no term chosen yet.
  priceUseTypeId: z.string().optional().or(z.literal('')),
  financingTermId: z.string().optional().or(z.literal('')),
  // Plain string, like every other free-text field on this form (not a zod
  // transform to number) — keeping the field's TS type a string end-to-end
  // avoids a useForm generic split just for this one input. The backend DTO
  // has @Type(() => Number), which class-transformer applies before
  // validation runs, so a numeric string round-trips through the API layer
  // as a real number; NewCreditApplicationForm normalizes '' to
  // undefined before submit (an empty string would otherwise coerce to 0,
  // not "no down payment").
  downPayment: z.string().optional().or(z.literal('')),
  // Client-only, like estimatedPrice above, and stripped the same way. The
  // item total as actually RESOLVED under the chosen Price Use — not the
  // flat catalog price — mirrored out of CreditApplicationFinancingFields
  // so refineDownPayment below can check the floor against the very number
  // the form is showing. Summing items[].estimatedPrice instead would use
  // the flat price and compute a floor off a different total (a real item
  // in the catalog differs by PHP 4,009 between the two).
  resolvedItemTotal: z.number().optional(),
  // Also client-only. The down-payment floor the SALE will demand, which is
  // not simply the floor rate applied to the total above: checkout measures
  // its floor against the tax-effective line amount, while an application is
  // priced from the ex-tax price list. With exclusive pricing and 12% VAT
  // that makes checkout's floor ~12% higher, so an application approved at
  // exactly its own floor could never be sold — the till would reject a down
  // payment the server had already accepted. The form computes the stricter
  // figure and passes it here. (Rate itself: DOWN_PAYMENT_FLOOR_RATE.)
  downPaymentFloor: z.number().optional(),
})

/**
 * Scenario 60 item 27 (client, 2026-09-30): PROPOSED PURCHASE AND INSTALLMENT
 * and PAPER RECORD AND CREDIT DECISION are **not optional**.
 *
 * Applied on create only. The edit schema stays a `.partial()` — the Edit
 * modal exposes items and terms alone, and demanding the paper record there
 * would make every existing draft uneditable.
 *
 * What is deliberately NOT required, because no one can type it at intake:
 *
 * - **Amount financed, monthly installment, total price** — derived by
 *   `resolveFinancing()` from the term, the price list and the down payment.
 * - **Item summary** — the items themselves, already required above.
 * - **Final decision, decision date, CIC/CICS name** — a decision is
 *   `decideItems()`, made later and by a Business Owner. `transcribedById`
 *   is stamped by the server.
 * - **Reason if disapproved** — only exists on a decline.
 * - **Linked invoice ID, installment account ID** — the mockup itself marks
 *   both "after posting".
 */
export function refinePurchaseAndPaperRecord(
  data: {
    priceUseTypeId?: string
    financingTermId?: string
    lcp?: string
    downPaymentCollection?: string
    firstDueDate?: string
    ppdRebate?: string
    posDraftReference?: string
    paperFormConfirmed?: boolean
    applicantIsUnitUser?: string
  },
  ctx: z.RefinementCtx
) {
  const required: [keyof typeof data, string][] = [
    ['priceUseTypeId', 'Price Use is required'],
    ['financingTermId', 'Financing term is required'],
    ['lcp', 'LCP is required'],
    ['downPaymentCollection', 'Down payment collection is required'],
    ['firstDueDate', 'First due date is required'],
    // A rebate of zero is a real answer; an empty box is not. Typing 0 is
    // what says "the form shows no rebate", and that reads differently from
    // nobody having looked.
    ['ppdRebate', 'PPD rebate is required — enter 0 if the form shows none'],
    ['posDraftReference', 'POS draft / quote ID is required'],
  ]
  for (const [field, message] of required) {
    if (!String(data[field] ?? '').trim()) {
      ctx.addIssue({ code: 'custom', path: [field], message })
    }
  }

  if (!data.paperFormConfirmed) {
    ctx.addIssue({
      code: 'custom',
      path: ['paperFormConfirmed'],
      message: 'Confirm the paper form is complete and signed',
    })
  }
  if (!data.applicantIsUnitUser) {
    ctx.addIssue({
      code: 'custom',
      path: ['applicantIsUnitUser'],
      message: 'Answer whether the applicant is the unit user',
    })
  }
}

/** Mirrors CreditApplicationService.resolveFinancing()'s own rules so a bad
 * down payment is caught under the field, at the moment it is typed, rather
 * than coming back as a generic banner after submit.
 *
 * The floor only applies once a financing term is chosen, which is exactly
 * when the server starts enforcing it — an application can still be raised
 * with no term yet. The half-centavo tolerance matches the server's, which
 * exists for float rounding on the client's computed 10%. */
export function refineDownPayment(
  data: {
    financingTermId?: string
    downPayment?: string
    resolvedItemTotal?: number
    downPaymentFloor?: number
  },
  ctx: z.RefinementCtx
) {
  if (!data.financingTermId) return

  const raw = data.downPayment?.trim()
  if (!raw) {
    ctx.addIssue({
      code: 'custom',
      path: ['downPayment'],
      message: 'Down payment is required once a term is selected',
    })
    return
  }

  const downPayment = Number(raw)
  if (Number.isNaN(downPayment)) {
    ctx.addIssue({ code: 'custom', path: ['downPayment'], message: 'Enter a valid amount' })
    return
  }

  // No resolved total yet (prices still loading) — the server still has the
  // final say, so don't invent a floor from a number we don't have.
  const total = data.resolvedItemTotal ?? 0
  if (total <= 0) return

  // Prefer the floor the form worked out from the tax-effective amount;
  // fall back to a plain 10% when it hasn't been supplied (an API caller,
  // or prices still resolving).
  const floor = data.downPaymentFloor ?? total * DOWN_PAYMENT_FLOOR_RATE
  if (downPayment < floor - 0.005) {
    // Name the basis the figure was actually worked out on. The panel below
    // this field shows the ex-tax item total, so "10% of the item total"
    // against a VAT-inclusive floor reads as plain bad arithmetic on screen
    // — ~11.2% of the number the collector can see. Only the fallback
    // branch really is 10% of that total.
    ctx.addIssue({
      code: 'custom',
      path: ['downPayment'],
      message:
        data.downPaymentFloor != null
          ? `Down payment must be at least ${pesos(floor)} — ${DOWN_PAYMENT_FLOOR_LABEL} of the sale amount incl. VAT, which is what the till will require`
          : `Down payment must be at least ${pesos(floor)} (${DOWN_PAYMENT_FLOOR_LABEL} of the item total)`,
    })
    return
  }
  if (downPayment > total) {
    ctx.addIssue({
      code: 'custom',
      path: ['downPayment'],
      message: `Down payment cannot exceed the item total (${pesos(total)})`,
    })
  }
}

function pesos(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const CreateCreditApplicationFormSchema = CreateCreditApplicationBaseSchema.superRefine(
  (data, ctx) => {
    // A co-maker on a credit application is identified by first name, last
    // name and relationship, plus a contact number (client request,
    // 2026-09-24 — Scenario 60). The number is not a nicety: a co-maker
    // exists to be reachable when the account goes bad, and CoMaker
    // .contactNumber is NOT NULL in the schema, so leaving it blank was
    // writing an empty string into a required column rather than failing.
    // Email stays optional.
    if (data.coMakerId === NEW_CO_MAKER_VALUE) {
      if (!data.newCoMakerFirstName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['newCoMakerFirstName'],
          message: 'First name is required',
        })
      }
      if (!data.newCoMakerLastName?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['newCoMakerLastName'],
          message: 'Last name is required',
        })
      }
      if (!data.newCoMakerRelationship?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['newCoMakerRelationship'],
          message: 'Relationship is required',
        })
      }
      if (!data.newCoMakerContactNumber?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['newCoMakerContactNumber'],
          message: 'Contact number is required',
        })
      }
    } else if (data.coMakerId) {
      // Editing an already-saved co-maker inline. Only the number is checked
      // here: this branch submits each field as `value || undefined`, so a
      // blank leaves the stored value untouched rather than overwriting it —
      // except that a co-maker saved before this rule can legitimately hold a
      // blank number, and this is what surfaces it for fixing instead of
      // letting it ride. Name/relationship are deliberately left unchecked,
      // matching what this branch already did.
      if (!data.coMakerContactNumber?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['coMakerContactNumber'],
          message: 'Contact number is required',
        })
      }
    }

    // Scenario 60 item 27 — a character reference row is all-or-nothing.
    // Nothing forces a row to exist (the minimum is "subject to NIG policy",
    // unstated), but a half-filled one is worse than none: a name with no
    // number cannot be called, and the backend requires the number whenever
    // a row is sent at all, so a partial row would 400 on submit rather than
    // here.
    ;(data.references ?? []).forEach((ref, index) => {
      const name = (ref?.name ?? '').trim()
      const mobile = (ref?.mobileNumber ?? '').trim()
      const relationship = (ref?.relationship ?? '').trim()
      const anyFilled = !!name || !!mobile || !!relationship
      if (!anyFilled) return
      if (!name) {
        ctx.addIssue({
          code: 'custom',
          path: ['references', index, 'name'],
          message: 'Name is required',
        })
      }
      if (!mobile) {
        ctx.addIssue({
          code: 'custom',
          path: ['references', index, 'mobileNumber'],
          message: 'Mobile number is required',
        })
      }
    })

    // Scenario 60 item 27 — a related-person row needs a role and a first
    // name. The mobile deliberately does not: the paper form offers "Father
    // mobile / unavailable", so a name with no number is a complete answer
    // here, unlike a character reference.
    //
    // Duplicate roles are caught here as well as on the backend. The unique
    // (application, role) index means a second "father" cannot be stored,
    // and the API answers 400 — but pointing at the offending row is far
    // more use than a banner above the form.
    const seenRoles = new Set<string>()
    ;(data.relatedPeople ?? []).forEach((person, index) => {
      const role = person?.role ?? ''
      const firstName = (person?.firstName ?? '').trim()
      const lastName = (person?.lastName ?? '').trim()
      const mobile = (person?.mobileNumber ?? '').trim()
      const anyFilled = !!role || !!firstName || !!lastName || !!mobile
      if (!anyFilled) return
      if (!role) {
        ctx.addIssue({
          code: 'custom',
          path: ['relatedPeople', index, 'role'],
          message: 'Pick who this is',
        })
      } else if (seenRoles.has(role)) {
        ctx.addIssue({
          code: 'custom',
          path: ['relatedPeople', index, 'role'],
          message: `Only one ${role} can be recorded`,
        })
      } else {
        seenRoles.add(role)
      }
      if (!firstName) {
        ctx.addIssue({
          code: 'custom',
          path: ['relatedPeople', index, 'firstName'],
          message: 'First name is required',
        })
      }
    })

    refineDownPayment(data, ctx)
    refinePurchaseAndPaperRecord(data, ctx)
  }
)
export type CreateCreditApplicationFormValues = z.infer<typeof CreateCreditApplicationBaseSchema>

// Editing a draft only ever touches item/notes today (see
// CreditApplicationDetail's "Edit" action) — applicant/co-maker/branch
// aren't exposed for edit, but the backend's PATCH accepts any subset via
// PartialType(CreateCreditApplicationDto), so this stays a full .partial()
// off the base (pre-refinement) schema.
// .superRefine, not a bare .partial(): the Edit modal exposes the financing
// fields too, so a draft edited down to a 1% down payment would otherwise
// sail past the form and be rejected by the server instead.
export const UpdateCreditApplicationFormSchema =
  CreateCreditApplicationBaseSchema.partial().superRefine(refineDownPayment)
export type UpdateCreditApplicationFormValues = z.infer<typeof UpdateCreditApplicationFormSchema>

export const CancelCreditApplicationFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})
export type CancelCreditApplicationFormValues = z.infer<typeof CancelCreditApplicationFormSchema>

// Scenario 29 POS-02 — replaces the old whole-application decline. Every
// item on the application must appear in exactly one of the two lists.
export const DecideCreditApplicationItemsFormSchema = z.object({
  approveItemIds: z.array(z.string()),
  declineItemIds: z.array(z.string()),
  declineReason: z.string().max(500).optional(),
})
export type DecideCreditApplicationItemsFormValues = z.infer<
  typeof DecideCreditApplicationItemsFormSchema
>

export const AttachCreditApplicationDocumentFormSchema = z.object({
  fileId: z.string().min(1, 'File is required'),
  documentType: CreditApplicationDocumentTypeSchema,
})
export type AttachCreditApplicationDocumentFormValues = z.infer<
  typeof AttachCreditApplicationDocumentFormSchema
>

export interface CreditApplicationCustomerLite {
  id: string
  name: string
  customerCode: string
  phone?: string | null
  email?: string | null
}

export interface CreditApplicationCoMakerLite {
  id: string
  name: string
  relationship: string
  contactNumber: string
  email?: string | null
}

export interface CreditApplicationBranchLite {
  id: string
  name: string
  code?: string | null
}

export interface CreditApplicationItemLite {
  id: string
  name: string
  sku?: string | null
  modelNumber?: string | null
  sellingPrice?: number | null
}

export interface CreditApplicationItemLine {
  id: string
  itemId: string
  item?: CreditApplicationItemLite | null
  requestedAmount: number
  status: CreditApplicationItemStatus
  decidedAt?: string | null
  decidedById?: string | null
}

export interface CreditApplication {
  id: string
  tenantId: string
  applicationNumber: string
  branchId: string
  branch: CreditApplicationBranchLite
  applicantCustomerId: string
  applicantCustomer: CreditApplicationCustomerLite
  coMakerId?: string | null
  coMaker?: CreditApplicationCoMakerLite | null
  items: CreditApplicationItemLine[]
  requestedAmount: number
  itemDescription?: string | null
  // 2026-09-18 — DP/terms captured at intake, all optional (an application
  // can still be raised with no term chosen). See
  // CreditApplicationService.resolveFinancing() for how these are computed.
  priceUseTypeId?: string | null
  priceUseType?: { id: string; name: string } | null
  financingTermId?: string | null
  financingTerm?: { id: string; termMonths: number; factorRate: number } | null
  downPayment?: number | null
  amountFinanced?: number | null
  monthlyInstallment?: number | null
  totalPayable?: number | null
  status: CreditApplicationStatus
  /** Scenario 60 item 27 — character references transcribed from the paper
   * form, ordered by their row on it. Empty array when none were recorded. */
  references?: {
    id: string
    position: number
    name: string
    relationship: string
    mobileNumber: string
  }[]
  /** Scenario 60 item 27 — the mockup's RELATED PEOPLE block, one row per
   * person. At most one of each role. `mobileNumber` is nullable on purpose:
   * the paper form offers "Father mobile / unavailable", so a blank is a
   * recorded answer rather than missing data. */
  relatedPeople?: {
    id: string
    role: 'spouse' | 'father' | 'mother'
    firstName: string
    lastName?: string | null
    mobileNumber?: string | null
  }[]
  /** Scenario 60 item 27 — PROPOSED PURCHASE AND INSTALLMENT, transcribed
   * from the paper form. `lcp` is hand-entered and feeds no calculation: the
   * mockup says `amount financed = LCP - downpayment`, but what LCP is has
   * not been confirmed, so the derived figures above still come from the
   * price list and the rate card. */
  lcp?: number | null
  downPaymentCollection?: 'online' | 'branch' | 'delivery' | null
  firstDueDate?: string | null
  ppdRebate?: number | null
  posDraftReference?: string | null
  /** Scenario 60 item 27 — PAPER RECORD. The credit decision itself is not
   * here; it stays with decideItems(). `applicantIsUnitUser` is tri-state —
   * null means the question was never asked, which is not the same as "no". */
  paperFormConfirmed?: boolean | null
  applicantIsUnitUser?: boolean | null
  transcribedById?: string | null
  transcribedAt?: string | null
  /** Scenario 60 item 27 — set by checkout when the sale it backed produced
   *  exactly one installment account. Null for a multi-term sale, where no
   *  single account is "the" one; posTransactionId still links the sale. */
  installmentAccountId?: string | null
  installmentAccount?: { id: string; accountNumber: string } | null
  /** Scenario 60 Part 6 — list-only. Whether an `applicant_id` document is
   * on file, so the queue can mark an approval as "ID pending" without
   * fetching every row's attachments. Set by findAll() alone; the detail
   * endpoint omits it and derives the same thing from the documents it
   * loads separately, hence optional. */
  hasApplicantId?: boolean
  createdById: string
  submittedAt?: string | null
  submittedById?: string | null
  investigatingAt?: string | null
  investigatingById?: string | null
  investigation?: CreditInvestigation | null
  approvedAt?: string | null
  approvedById?: string | null
  declinedAt?: string | null
  declinedById?: string | null
  declineReason?: string | null
  cancelledAt?: string | null
  cancelledById?: string | null
  cancelReason?: string | null
  // Scenario 17 Part 6 — set once an approved application is consumed by a
  // POS installment checkout; null while it's still available for one.
  posTransactionId?: string | null
  posTransaction?: { id: string; transactionNumber: string } | null
  createdAt: string
  updatedAt: string
}

export interface CreditApplicationDocument {
  id: string
  creditApplicationId: string
  documentType: CreditApplicationDocumentType
  fileId: string
  uploadedById: string
  uploadedAt: string
  file: {
    id: string
    originalName: string
    mimeType: string
    size: number
    uploadedAt: string
  }
}

export interface CreditApplicationListResponse {
  data: CreditApplication[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface PromissoryNoteScheduleLine {
  lineNumber: number
  dueDate: string
  amount: number
}

export interface PromissoryNote {
  id: string
  creditApplicationId: string
  releaseFormRequestId: string
  /** Per-line installment financing (2026-08-06) — one note per cart line,
   * matching the line's own index in the originating sale's `lines[]`. */
  lineIndex: number
  financingTermId: string
  termMonths: number
  factorRate: number
  totalAmount: number
  downPayment: number
  amountFinanced: number
  totalPayable: number
  monthlyInstallment: number
  scheduleLines: PromissoryNoteScheduleLine[]
  generatedAt: string
  generatedById: string
  signedAt?: string | null
  signedById?: string | null
  createdAt: string
  updatedAt: string
}
