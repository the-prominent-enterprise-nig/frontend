'use client'

type Props = {
  employeeName?: string | null
}

export default function MyPayslipsView({ employeeName }: Props) {
  return (
    <div className="px-6 py-8 text-center text-sm text-zinc-400">
      Payslips for {employeeName ?? 'Employee'} coming soon.
    </div>
  )
}
