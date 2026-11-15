import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import { CursorGlow } from '@/components/CursorGlow'
import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import { AuthProvider } from '@/lib/auth'
import './globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['wdth', 'opsz'],
  variable: '--font-bricolage',
  display: 'swap',
})
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'HOMIE: Find your place. Find your people.', template: '%s | HOMIE' },
  description:
    'HOMIE is the student housing network for USC. Subleases, lease takeovers, rooms and roommates, matched by AI and backed by honest resident reviews.',
}
export const viewport: Viewport = { themeColor: '#990000' }

// Applies a saved theme before first paint so there is no flash.
const themeScript = `try{var t=localStorage.getItem('homie-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <CursorGlow />
          <div className="relative z-10 flex min-h-dvh flex-col">
            <Nav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
