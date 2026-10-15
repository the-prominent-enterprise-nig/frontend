import { AgingFilters } from './AgingFilters'
import type { AgingFilterOptions } from '../_data'
import type { AgingFilters as AgingFilterValues } from '../_params'

/** Server wrapper: waits for the dropdown options, then hands them to the client bar. */
export async function AgingFilterBar({
  options,
  values,
}: {
  options: Promise<AgingFilterOptions>
  values: AgingFilterValues
}): Promise<React.JSX.Element> {
  return <AgingFilters options={await options} values={values} />
}
