import { redirectToFirstHubTab } from '../_shared/hub-entry'
import { BOOKS_HUB } from '../_shared/hubs'

export const metadata = { title: 'Books | NIG Central' }

export default function BooksPage() {
  return redirectToFirstHubTab(BOOKS_HUB)
}
