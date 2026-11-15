// Empty base URL means same origin: the Vite dev proxy forwards /api to FastAPI.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = 'homie.session'

// Browser storage can be unavailable (private modes, sandboxed frames).
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string | null) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      // Session then lasts only for this page view.
    }
  },
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenStore.get()
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Could not reach the HOMIE API')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const validation = Array.isArray(body?.detail) ? body.detail[0]?.msg : undefined
    throw new ApiError(
      res.status,
      body?.error?.message ?? validation ?? `Request failed (${res.status})`,
    )
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export type Health = {
  status: 'ok' | 'degraded'
  version: string
  database: 'ok' | 'unavailable'
  storage: 'postgres' | 'temporary' | 'sqlite'
  auth_mode: 'email' | 'demo'
  llm_provider: string
  embedding_provider: string
}

export type Lifestyle = {
  sleep_schedule?: 'early' | 'flexible' | 'late'
  cleanliness?: number
  noise_tolerance?: number
  guests_frequency?: number
  smoking?: boolean
  drinking?: boolean
  diet?: 'veg' | 'non_veg'
  pets?: boolean
}

export type SeekerCriteria = {
  budget_max: number
  move_in: string
  move_out?: string
  preferred_neighborhoods?: string[]
  max_distance_miles?: number
  lifestyle?: Lifestyle
}

export type ListingCriteria = {
  id?: string | number
  monthly_rent: number
  available_from: string
  available_to?: string
  neighborhood?: string
  latitude?: number
  longitude?: number
  lifestyle?: Lifestyle
}

export type FactorScore = {
  factor: 'budget' | 'dates' | 'location' | 'lifestyle' | 'semantic'
  score: number
  weight: number
  reason: string
}

export type MatchResult = {
  listing_id: string | number | null
  score: number
  factors: FactorScore[]
  highlights: string[]
  concerns: string[]
}

export type User = {
  id: number
  email: string
  full_name: string
  is_usc_verified: boolean
}

export type CodeRequestResult = {
  email: string
  delivered_by_email: boolean
  demo_code: string | null
}

export const ROOMMATE_TAGS = [
  'friendly',
  'clean',
  'quiet',
  'social',
  'respectful',
  'studious',
  'pays on time',
  'shares chores',
] as const
export type RoommateTag = (typeof ROOMMATE_TAGS)[number]

export type Feedback = {
  id: number
  rating: number
  tags: string[]
  comment: string
  author_name: string
  author_verified: boolean
  created_at: string
}

export type ListingType = 'sublease' | 'lease_takeover' | 'room' | 'roommate_replacement'

export type Listing = {
  id: number
  listing_type: ListingType
  title: string
  description: string
  building_name: string | null
  address: string | null
  unit: string | null
  neighborhood: string | null
  monthly_rent: number
  available_from: string
  available_to: string | null
  lifestyle: Lifestyle
  owner_name: string
  owner_id: number
  is_demo: boolean
  roommate_feedback: { count: number; average_rating: number | null; top_tags: string[] }
}

export type ListingDetail = Listing & { feedback: Feedback[] }

export type ListingPage = { total: number; items: Listing[] }

export type ListingQuery = {
  q?: string
  listing_type?: ListingType
  neighborhood?: string
  max_rent?: number
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'soonest'
  limit?: number
  offset?: number
}

export type ListingMatch = { listing: Listing; match: MatchResult }

export const NEIGHBORHOODS = [
  'University Park',
  'North University Park',
  'Figueroa Corridor',
  'Exposition Park',
] as const

export type NewListing = {
  listing_type: ListingType
  title: string
  description: string
  building_name: string
  address: string
  unit?: string
  neighborhood?: string
  monthly_rent: number
  available_from: string
  available_to?: string
  lifestyle: Lifestyle
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/api/health'),
  requestCode: (email: string) =>
    request<CodeRequestResult>('/api/auth/request-code', post({ email })),
  verifyCode: (email: string, code: string) =>
    request<{ token: string; user: User }>('/api/auth/verify', post({ email, code })),
  me: () => request<User>('/api/auth/me'),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  listings: (query: ListingQuery = {}) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '' && v !== null) params.set(k, String(v))
    }
    const qs = params.toString()
    return request<ListingPage>(`/api/listings${qs ? `?${qs}` : ''}`)
  },
  matchListings: (seeker: SeekerCriteria, listing_types: ListingType[], limit = 20) =>
    request<{ scanned: number; results: ListingMatch[] }>(
      '/api/matching/listings',
      post({ seeker, listing_types, limit }),
    ),
  listing: (id: number) => request<ListingDetail>(`/api/listings/${id}`),
  createListing: (data: NewListing) => request<ListingDetail>('/api/listings', post(data)),
  postFeedback: (id: number, data: { rating: number; tags: string[]; comment: string }) =>
    request<Feedback>(`/api/listings/${id}/roommate-feedback`, post(data)),
  scoreMatch: (seeker: SeekerCriteria, listing: ListingCriteria, signal?: AbortSignal) =>
    request<MatchResult>('/api/matching/score', {
      method: 'POST',
      body: JSON.stringify({ seeker, listing }),
      signal,
    }),
}
