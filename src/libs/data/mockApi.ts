import data from '@/src/mocks/attendace.json'

// simulate delay
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

export async function getAttendanceLogs() {
  await delay(300)
  return data.logs
}

export async function getAttendanceSummary() {
  await delay(300)
  return data.summary
}

export async function getShiftSchedules() {
  await delay(300)
  return data.shiftSchedules
}

export async function getCorrectionRequests() {
  await delay(300)
  return data.correctionRequests
}

export async function getOvertimeRequests() {
  await delay(300)
  return data.overtimeRequests
}

export async function getStatusTypes() {
  await delay(300)
  return data.statusTypes
}

export async function getAdjustments() {
  await delay(300)
  return data.adjustments
}
