import SpecialAccountLedgerView from './_components/SpecialAccountLedgerView'

export const metadata = {
  title: 'Special Account Ledger | Prominent Enterprise',
}

// Identified by (control account, name) rather than by an id: the balances
// that predate the register have no record of their own, and they are the
// ones with the most history to show.
export default async function SpecialAccountLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; name?: string }>
}) {
  const { accountId, name } = await searchParams
  return <SpecialAccountLedgerView accountId={accountId ?? ''} name={name ?? ''} />
}
