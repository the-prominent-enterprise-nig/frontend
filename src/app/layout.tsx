import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import './globals.css'
import NumberInputScrollGuard from '@/src/components/common/NumberInputScrollGuard'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
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
    <html lang="en" className={poppins.variable}>
      <body className="font-sans antialiased">
        <NumberInputScrollGuard />
        {children}
      </body>
    </html>
  )
}
