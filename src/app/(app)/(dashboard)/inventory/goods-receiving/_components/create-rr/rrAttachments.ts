/** The supporting documents a Receiving Report must carry before it can post.
 * Only the returns have any: a plain delivery is backed by the supplier's own
 * DR/invoice, which are typed fields rather than files.
 *
 * UDS = Unit Document Sheet (custody record), RFS = Repair Form Sheet. */
export type RrAttachmentKind = 'UDS' | 'RFS'

export const RR_ATTACHMENT_LABELS: Record<RrAttachmentKind, string> = {
  UDS: 'UDS — Unit Document Sheet',
  RFS: 'RFS — Repair Form Sheet',
}

export function requiredAttachmentKinds(reason?: string, repairType?: string): RrAttachmentKind[] {
  if (reason === 'repossession') return ['UDS']
  if (reason === 'repair_return') {
    if (repairType === 'in_store') return ['UDS', 'RFS']
    if (repairType === 'home_service') return ['RFS']
  }
  return []
}
