import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Simulateur Fiscal 2025 — Belho Xper',
  description: 'Comparez Micro, EI, EURL/SARL IS, SAS/SASU. Calculs fiscaux 2025 précis : IR, cotisations SSI, IS. Gratuit, sans engagement.',
  keywords: ['simulateur fiscal', 'forme juridique', 'micro-entreprise', 'SASU', 'EURL', 'EI', 'expert-comptable Lyon'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
