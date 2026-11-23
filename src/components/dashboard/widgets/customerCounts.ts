import { customersApi } from '@/src/libs/api/crm'

// The backend's cap on one `ids` filter.
const IDS_PER_REQUEST = 200

/**
 * How many customers registered on/after `sinceIso` — counted by the server
 * (the list's `meta.total`), not by loading customers and counting the ones
 * that happen to be in the first page. The customer list is ordered by name
 * and has hundreds of thousands of rows, so a page of 200 says nothing about
 * who is new.
 *
 * With `ids`, only among those customers (a branch's, say), asked in chunks of
 * 200.
 */
export async function countCustomersRegisteredSince(
  sinceIso: string,
  ids?: string[]
): Promise<number> {
  if (!ids) {
    const res = await customersApi.list({ limit: 1, createdFrom: sinceIso })
    return res.data?.meta?.total ?? 0
  }
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IDS_PER_REQUEST) {
    chunks.push(ids.slice(i, i + IDS_PER_REQUEST))
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      customersApi.list({ limit: 1, createdFrom: sinceIso, ids: chunk.join(',') })
    )
  )
  return results.reduce((sum, res) => sum + (res.data?.meta?.total ?? 0), 0)
}
