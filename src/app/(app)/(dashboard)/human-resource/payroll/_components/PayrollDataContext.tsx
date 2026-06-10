'use client'

import React, { createContext, useContext, useCallback, useRef } from 'react'

interface PayrollContextValue {
  getPayrollData: () => Record<string, Record<string, number>>
  updatePayrollData: (employeeId: string, data: Record<string, number>) => void
}

const PayrollDataContext = createContext<PayrollContextValue | null>(null)

export function PayrollDataProvider({ children }: { children: React.ReactNode }) {
  const payrollDataRef = useRef<Record<string, Record<string, number>>>({})

  const updatePayrollData = useCallback((employeeId: string, data: Record<string, number>) => {
    payrollDataRef.current[employeeId] = data
  }, [])

  const getPayrollData = useCallback(() => payrollDataRef.current, [])

  return (
    <PayrollDataContext.Provider value={{ getPayrollData, updatePayrollData }}>
      {children}
    </PayrollDataContext.Provider>
  )
}

export function usePayrollDataContext() {
  const ctx = useContext(PayrollDataContext)
  if (!ctx) throw new Error('usePayrollDataContext must be used inside PayrollDataProvider')
  return ctx
}
