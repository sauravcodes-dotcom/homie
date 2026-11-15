import { ApiStatus } from './components/ApiStatus'
import { AuthProvider, useAuth } from './lib/auth'
import { useRoute } from './lib/router'
import { Home } from './pages/Home'
import { ListingDetail } from './pages/ListingDetail'
import { Match } from './pages/Match'
import { Listings } from './pages/Listings'
import { PostListing } from './pages/PostListing'
import { SignIn } from './pages/SignIn'

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  )
}

function Layout() {
  const route = useRoute()
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {route.name === 'home' && <Home />}
        {route.name === 'listings' && <Listings />}
        {route.name === 'listing' && <ListingDetail id={route.id} />}
        {route.name === 'post' && <PostListing />}
        {route.name === 'match' && <Match />}
        {route.name === 'signin' && <SignIn next={route.next} />}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>HOMIE is a student project and is not affiliated with USC.</span>
        <ApiStatus />
      </footer>
    </div>
  )
}

function Header() {
  const { user, signOut } = useAuth()
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <a href="#/" className="flex items-center gap-2.5" aria-label="HOMIE home">
        <img src="/favicon.svg" alt="" className="size-8" />
        <span className="display text-2xl font-extrabold text-jacaranda">HOMIE</span>
      </a>
      <nav className="flex items-center gap-5 text-sm font-medium">
        <a href="#/listings" className="hover:text-jacaranda">
          Open rooms
        </a>
        <a href="#/match" className="hover:text-jacaranda">
          Find my match
        </a>
        {user ? (
          <>
            <span className="hidden text-ink-soft md:inline">{user.email}</span>
            <button type="button" onClick={signOut} className="hover:text-jacaranda">
              Sign out
            </button>
          </>
        ) : (
          <a
            href="#/signin"
            className="rounded-full bg-jacaranda px-4 py-2 text-petal hover:bg-jacaranda-dark"
          >
            Sign in with USC email
          </a>
        )}
      </nav>
    </header>
  )
}
