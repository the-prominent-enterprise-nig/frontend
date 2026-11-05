'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { SalesReportsParams } from '@/src/schema/pos/sales-reports'
import { getSalesByMonth } from '../../_actions/get-sales-reports'
import MonthBarsPanel from './MonthBarsPanel'
import MonthTablePanel from './MonthTablePanel'

/**
 * Scenario 85 Part 3 — the Dashboard tab: Top models and Units by brand as
 * month-segmented bars, with the same figures as month tables beneath.
 */

const TOP = 10

function useByMonth(params: SalesReportsParams, dimension: 'model' | 'brand', showAll: boolean) {
  return useQuery({
    queryKey: ['pos-sales-report-by-month', dimension, params, showAll],
    queryFn: async () => {
      const res = await getSalesByMonth({
        ...params,
        dimension,
        top: showAll ? undefined : TOP,
      })
      if (!res.success || !res.data) throw new Error(res.error ?? 'Could not load sales')
      return res.data
    },
    placeholderData: keepPreviousData,
  })
}

export default function DashboardTab({
  params,
}: {
  params: SalesReportsParams
}): React.JSX.Element {
  const [allModels, setAllModels] = useState(false)
  const [allBrands, setAllBrands] = useState(false)
  const models = useByMonth(params, 'model', allModels)
  const brands = useByMonth(params, 'brand', allBrands)

  if (models.isError || brands.isError) {
    return (
      <p
        role="tabpanel"
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        Could not load the dashboard for these filters. Try again, or narrow the date range.
      </p>
    )
  }

  return (
    <div role="tabpanel" className="grid gap-4 lg:grid-cols-2">
      <MonthBarsPanel
        title="Top models"
        subtitle="Units sold, split by month. Top 10 shown."
        data={models.data}
        loading={models.isLoading}
      />
      <MonthBarsPanel
        title="Units by brand"
        subtitle="Units sold, split by month."
        data={brands.data}
        loading={brands.isLoading}
      />
      <MonthTablePanel
        title="Top models by month"
        keyHeader="Model"
        showBrand
        data={models.data}
        loading={models.isLoading}
        showAll={allModels}
        onShowAll={setAllModels}
      />
      <MonthTablePanel
        title="Brands by month"
        keyHeader="Brand"
        showBrand={false}
        data={brands.data}
        loading={brands.isLoading}
        showAll={allBrands}
        onShowAll={setAllBrands}
      />
    </div>
  )
}
