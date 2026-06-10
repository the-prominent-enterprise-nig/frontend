import { FormData, TabId } from '../types'

export const TAB_ORDER: TabId[] = ['basic', 'employment', 'personal', 'payroll']

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

export const INITIAL_FORM: FormData = {
  employeeCode: '',
  firstName: '',
  lastName: '',
  middleName: undefined,
  email: '',
  contactNumber: '',
  hireDate: undefined,
  status: 'active',
  bloodType: undefined,
  dateOfBirth: '',
  maritalStatus: 'Single',
  pwdType: undefined,
  allowance: 0,
  allowancePayoutCycle: 'FirstCycle',
  loan: 0,
  loanDeduction: 0,
  silc: 0,
  departmentId: undefined,
  positionId: undefined,
  branchId: undefined,
  roleIds: undefined,
}
