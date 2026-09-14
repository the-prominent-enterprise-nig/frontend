import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans, Poppins } from 'next/font/google'
import './globals.css'
import NumberInputScrollGuard from '@/src/components/common/NumberInputScrollGuard'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
})

// IBM Plex is opt-in, not a default: it backs the procurement screens whose
// design calls for it, reached through the PLEX / MONO constants in
// PurchaseOrderList, which bind to the two CSS variables below. The app-wide
// `--font-sans` / `--font-mono` tokens in globals.css still resolve to Poppins.
//
// Do NOT write Tailwind's square-bracket arbitrary-value syntax for binding
// font-family to one of these two CSS variables anywhere in this repo,
// comments or docs included, unless it names a real, complete variable (as
// PLEX / MONO in procurementTokens.tsx do). Tailwind v4 scans plain text for
// class candidates, so a placeholder or partial version of that syntax
// compiles into invalid CSS and 500s every page in the app rather than
// failing quietly on the one screen.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'Prominent Enterprise',
  description: 'Smart Solutions for Smart Businesses',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // The Poppins variable lives on <html> so `--font-poppins` — and therefore
    // the `--font-sans`/`--font-mono` theme tokens that reference it — resolves
    // for every element, including the base `html { font-sans }` rule.
    <html lang="en" className={`${poppins.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        <NumberInputScrollGuard />
        {children}
      </body>
    </html>
  )
}
