import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import NumberInputScrollGuard from '@/src/components/common/NumberInputScrollGuard'

// Self-hosted (latin subset, ./fonts) instead of next/font/google: the Google
// loader downloads at build time, and a failed download breaks the whole
// Vercel/CI build with a cryptic Turbopack "module not found" on the font.
const poppins = localFont({
  src: [
    { path: './fonts/Poppins-300.woff2', weight: '300', style: 'normal' },
    { path: './fonts/Poppins-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/Poppins-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/Poppins-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/Poppins-700.woff2', weight: '700', style: 'normal' },
    { path: './fonts/Poppins-800.woff2', weight: '800', style: 'normal' },
  ],
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
const plexSans = localFont({
  src: [
    {
      path: './fonts/IBMPlexSans-Variable.woff2',
      weight: '400 600',
      style: 'normal',
    },
  ],
  variable: '--font-plex-sans',
})

const plexMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexMono-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-mono',
})

export const metadata: Metadata = {
  title: 'NIG Central',
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
