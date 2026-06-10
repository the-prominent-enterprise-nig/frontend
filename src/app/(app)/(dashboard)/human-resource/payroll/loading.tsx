export default function PayrollLoadingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full bg-white flex-col items-center justify-center dark:bg-black">
        <h1 className="text-4xl">Loading Payroll...</h1>
        <p className="mt-4 text-lg">Please wait while we load the payroll data.</p>
      </main>
    </div>
  )
}
