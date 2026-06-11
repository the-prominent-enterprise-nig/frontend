'use client'

type Props = {
  employeeName: string
}

export default function MyTimeLogView({ employeeName }: Props) {
  return (
    <div className="px-6 py-8 text-center text-sm text-zinc-400">
      Time log for {employeeName} coming soon.
    </div>
  )
}
