import z from 'zod'

export const EmployeeStatusSchema = z.enum(['active', 'inactive', 'resigned', 'terminated'])
export const MaritalStatusSchema = z.enum(['Single', 'Married', 'Widowed', 'Separated'])
export const PayoutCycleSchema = z.enum(['FirstCycle', 'SecondCycle'])
