import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <main className="flex flex-col items-center justify-center text-center px-4">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100">
          <FileQuestion className="h-10 w-10 text-purple-500" />
        </div>

        <h1 className="text-5xl font-bold text-gray-900">404</h1>
        <p className="mt-2 text-xl font-semibold text-gray-700">Page Not Found</p>
        <p className="mt-2 text-sm text-gray-500 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </main>
    </div>
  )
}
