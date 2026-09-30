'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreateCreditApplicationFormSchema } from '@/src/schema/credit/applications'
import type { CreditApplication } from '@/src/schema/credit/applications'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { CREDIT_PERMISSIONS } from '@/src/libs/guards/credit-permissions'

export async function createCreditApplication(
  input: unknown
): Promise<ApiResponse<CreditApplication>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, CREDIT_PERMISSIONS.APPLICATION_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to submit a credit application',
    }
  }

  const parsed = CreateCreditApplicationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const payload = {
    ...parsed.data,
    // Backend trusts this client-supplied price over its own Price List
    // resolution — see credit/applications schema's items.estimatedPrice comment.
    // Scenario 60 item 21 (client, 2026-09-28): the price must come from the
    // Inventory price list for the chosen Price Use, "and only that".
    // unitPrice is deliberately NOT sent. It used to carry the form's
    // estimatedPrice, which is seeded from the flat Item.sellingPrice — and
    // a client-supplied unitPrice makes the server skip price-list
    // resolution entirely, so the application was priced off the wrong
    // number AND lost its priceListItemId, which is what the curated down
    // payment and the rate-card instalment figures hang off. estimatedPrice
    // stays in the form for the on-screen financing preview only.
    items: parsed.data.items.map(({ itemId }) => ({ itemId })),
    // Scenario 60 item 27. Rows are added as needed rather than being three
    // fixed slots, so `position` is renumbered over the FILLED rows: blanks
    // are dropped first, then 1..n. Numbering over the form's own indices
    // would leave a gap whenever a middle row was cleared rather than
    // removed, and the unique (application, position) index would then
    // record a hole that means nothing.
    references: (parsed.data.references ?? [])
      .map((r) => ({
        name: (r?.name ?? '').trim(),
        relationship: (r?.relationship ?? '').trim(),
        mobileNumber: (r?.mobileNumber ?? '').trim(),
      }))
      .filter((r) => r.name || r.mobileNumber || r.relationship)
      .map((r, index) => ({ ...r, position: index + 1 })),
    // Scenario 60 item 27 — untouched rows are dropped, the same way the
    // references above are. A row is only sent once it has both a role and
    // a name: the DTO requires them, and neither a nameless role nor a
    // mobile with nobody attached to it is a person. There is no `position`
    // here — the role IS the identity, and the unique (application, role)
    // index allows one of each.
    relatedPeople: (parsed.data.relatedPeople ?? [])
      .map((person) => ({
        role: person?.role ?? '',
        firstName: (person?.firstName ?? '').trim(),
        lastName: (person?.lastName ?? '').trim() || undefined,
        mobileNumber: (person?.mobileNumber ?? '').trim() || undefined,
      }))
      .filter((person) => person.role && person.firstName),
    // Numeric text inputs: '' must become undefined, not 0 — the DTO's
    // @Type(() => Number) would coerce an empty string to 0, and "LCP 0" is
    // a claim about money that nobody made.
    lcp: parsed.data.lcp ? Number(parsed.data.lcp) : undefined,
    ppdRebate: parsed.data.ppdRebate ? Number(parsed.data.ppdRebate) : undefined,
    // Same for the selects — @IsOptional() skips undefined/null, not ''.
    firstDueDate: parsed.data.firstDueDate || undefined,
    downPaymentCollection: parsed.data.downPaymentCollection || undefined,
    posDraftReference: parsed.data.posDraftReference || undefined,
    // Tri-state on purpose: unasked is not the same answer as "no", so an
    // untouched dropdown stays null on the record instead of reading as a
    // recorded denial.
    applicantIsUnitUser:
      parsed.data.applicantIsUnitUser === 'yes'
        ? true
        : parsed.data.applicantIsUnitUser === 'no'
          ? false
          : undefined,
  }

  const result = await api.post<CreditApplication>('/credit/applications', payload)
  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create credit application',
      message: msg || errStr || 'Failed to create credit application',
    }
  }

  revalidatePath('/pos/credit-applications')

  return { success: true, data: result.data, message: 'Credit application saved as draft' }
}
