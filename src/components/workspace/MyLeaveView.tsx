'use client'

type Props = {
  employeeId: string
  employeeName: string
}

export default function MyLeaveView({ employeeName }: Props) {
  return (
    <div className="px-6 py-8 text-center text-sm text-zinc-400">
      Leave management for {employeeName} coming soon.
    </div>
  )
}
