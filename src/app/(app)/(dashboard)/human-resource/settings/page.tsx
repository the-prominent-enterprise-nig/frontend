import { logoutAndRedirect } from '@/src/libs/auth/actions/login'

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center font-sans dark:bg-black">
      <main className="flex min-h-screen w-full flex-col items-center justify-center dark:bg-black">
        <h1 className="text-4xl">HR Settings</h1>
        <p className="mt-4 text-lg">Here you can manage your HR settings and preferences.</p>
        <form action={logoutAndRedirect} className="mt-8">
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            Logout
          </button>
        </form>
      </main>
    </div>
  )
}
