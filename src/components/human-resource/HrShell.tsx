type HrShellProps = {
  children: React.ReactNode
}

export default function HrShell({ children }: Readonly<HrShellProps>) {
  return <section className="min-h-full">{children}</section>
}
