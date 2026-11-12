/**
 * The backend refuses edits while an item is mid-review (Accounting confirming
 * it, or awaiting the Master Data Approver) so the reviewer never looks at
 * stale data — `item_pending_review_cannot_be_edited`. Draft, rejected and
 * approved items are all editable.
 */
export function isItemLockedForReview(item: { approvalStatus?: string | null }): boolean {
  return (
    item.approvalStatus === 'pending_accounting_confirmation' ||
    item.approvalStatus === 'pending_approval'
  )
}
