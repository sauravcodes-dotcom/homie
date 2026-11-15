import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google'
import { CommandPalette } from '@/components/CommandPalette'
import { CursorGlow } from '@/components/CursorGlow'
import { Footer } from '@/components/Footer'
import { Gameday } from '@/components/Gameday'
import { MotionProvider } from '@/components/MotionProvider'
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

// Applies a saved theme before first paint so there is no flash. "la" follows daylight in Los
// Angeles (light from just before sunrise until sunset), matching laTheme() in ThemeToggle.
const themeScript = `try{var t=localStorage.getItem('homie-theme');if(t==='la'){var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'numeric',month:'numeric',hourCycle:'h23'}).formatToParts(new Date()),g=function(k){for(var i=0;i<p.length;i++)if(p[i].type===k)return +p[i].value;return 0},h=g('hour')+g('minute')/60,S=[[6.95,17.2],[6.7,17.65],[6.6,19],[6.5,19.4],[5.95,19.8],[5.7,20.1],[5.85,20.1],[6.2,19.7],[6.6,19.1],[7,18.4],[6.4,16.9],[6.8,16.8]][g('month')-1];t=h>=S[0]-0.5&&h<S[1]?'light':'dark'}if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <MotionProvider>
          <CursorGlow />
          <CommandPalette />
          <div className="relative z-10 flex min-h-dvh flex-col">
            <Gameday />
            <Nav />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          </MotionProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
