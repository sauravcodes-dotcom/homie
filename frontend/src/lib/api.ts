// All requests are same-origin: Next (dev) or Vercel (prod) routes /api to FastAPI.
// The session is a bearer token returned by /auth/verify and kept in localStorage.

const TOKEN_KEY = 'homie-token'
let memoryToken: string | null = null

// Browser storage can be unavailable (private modes, sandboxed frames); fall back to memory.
export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(TOKEN_KEY)
    } catch {
      return memoryToken
    }
  },
  set(token: string | null) {
    memoryToken = token
    try {
      if (token) window.localStorage.setItem(TOKEN_KEY, token)
      else window.localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* memory only */
    }
  },
}

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  const isForm = init?.body instanceof FormData
  const token = tokenStore.get()
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'Could not reach the HOMIE API')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const detail = Array.isArray(body?.detail) ? body.detail[0]?.msg : body?.detail
    throw new ApiError(
      res.status,
      body?.error?.message ?? detail ?? `Request failed (${res.status})`,
    )
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Fetch a protected file (e.g. a residency document) as an object URL. */
export async function fetchBlobUrl(path: string) {
  const token = tokenStore.get()
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new ApiError(res.status, 'Could not load the file')
  return URL.createObjectURL(await res.blob())
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const get = <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal })
export const post = <T>(path: string, body?: unknown) => request<T>(path, json('POST', body))
export const put = <T>(path: string, body?: unknown) => request<T>(path, json('PUT', body))
export const patch = <T>(path: string, body?: unknown) => request<T>(path, json('PATCH', body))
export const del = <T = void>(path: string) => request<T>(path, { method: 'DELETE' })

export function upload<T>(path: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<T>(path, { method: 'POST', body: form })
}

export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// ---- Types (mirror backend/app/schemas) ----

export type Health = {
  status: 'ok' | 'degraded'
  version: string
  database: 'ok' | 'unavailable'
  // "temporary" = throwaway storage on a serverless host; data resets periodically.
  storage: 'postgres' | 'temporary' | 'sqlite'
  auth_mode: 'email' | 'demo'
  llm_provider: string
  embedding_provider: string
}

export type User = {
  id: number
  email: string
  full_name: string
  is_usc_verified: boolean
  is_admin: boolean
  has_profile: boolean
}

export type PublicUser = { id: number; display_name: string; is_usc_verified: boolean }

export type Lifestyle = {
  sleep_schedule?: 'early' | 'flexible' | 'late' | null
  cleanliness?: number | null
  noise_tolerance?: number | null
  guests_frequency?: number | null
  smoking?: boolean | null
  drinking?: boolean | null
  diet?: 'veg' | 'non_veg' | null
  pets?: boolean | null
  personality?: Personality | null
}

export const TRAITS = ['organized', 'laid_back', 'talkative', 'reserved', 'spontaneous', 'planner', 'homebody', 'adventurous'] as const
export const INTERESTS = ['cooking', 'fitness', 'gaming', 'music', 'movies', 'outdoors', 'sports', 'art', 'reading', 'nightlife', 'tech', 'faith'] as const
export type Trait = (typeof TRAITS)[number]
export type Interest = (typeof INTERESTS)[number]

/** Who someone is to live with. On a listing it describes the current roommates. */
export type Personality = {
  social_energy?: number | null
  home_vibe?: 'quiet' | 'balanced' | 'social' | null
  study_style?: 'at_home' | 'library' | 'mix' | null
  communication?: 'direct' | 'easygoing' | null
  traits?: Trait[]
  interests?: Interest[]
  about?: string | null
}

export type Session = { token: string; user: User }
export type CodeRequest = { email: string; delivered_by_email: boolean; demo_code: string | null }

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
export type Feedback = {
  id: number
  rating: number
  tags: string[]
  comment: string
  author_name: string
  author_verified: boolean
  created_at: string
}
/** HOMIE score from the rating engine (docs/rating-model.html). low-high is the likely range. */
export type RatingSummary = {
  score: number
  low: number
  high: number
  rank_key: number
  confidence: 'low' | 'medium' | 'high'
  rated_reviews: number
}
export type FeedbackSummary = {
  count: number
  average_rating: number | null
  rating: RatingSummary | null
  top_tags: string[]
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
  lifestyle?: Lifestyle
}

export type Factor = 'budget' | 'dates' | 'location' | 'lifestyle' | 'personality' | 'semantic'
export type FactorScore = { factor: Factor; score: number; weight: number; reason: string }
export type MatchResult = {
  listing_id: string | number | null
  score: number
  factors: FactorScore[]
  highlights: string[]
  concerns: string[]
  /** How the two personalities fit, in a sentence or two. */
  personality_fit?: string | null
}

export type ListingType = 'sublease' | 'lease_takeover' | 'room' | 'roommate_replacement'
export type RiskFlag = { code: string; severity: 'low' | 'medium' | 'high'; message: string }
export type RiskReport = { level: 'low' | 'medium' | 'high'; flags: RiskFlag[] }
export type Travel = { miles: number; walk_minutes: number; bike_minutes: number }
export type Benchmark = {
  scope: 'building' | 'neighborhood' | 'all'
  scope_label: string
  sample_size: number
  median: number
  p25: number
  p75: number
  diff_pct: number
  verdict: 'below' | 'typical' | 'above'
}

export type Listing = {
  id: number
  listing_type: ListingType
  title: string
  description: string
  monthly_rent: number
  available_from: string
  available_to: string | null
  neighborhood: string | null
  latitude: number | null
  longitude: number | null
  apartment_id: number | null
  building_name: string | null
  address: string | null
  unit: string | null
  lifestyle: Lifestyle
  photos: string[]
  is_active: boolean
  is_demo: boolean
  created_at: string
  owner: PublicUser
  owner_id: number
  owner_name: string
  roommate_feedback: FeedbackSummary
  is_mine: boolean
  is_saved: boolean
  risk: RiskReport | null
  travel: Travel | null
  /** The current roommates' personality, in a sentence or two. */
  household: string | null
}
export type ListingDetail = Listing & {
  feedback: Feedback[]
  benchmark: Benchmark | null
  match: MatchResult | null
}
export type ListingInput = {
  listing_type: ListingType
  title: string
  description: string
  monthly_rent: number
  available_from: string
  available_to: string | null
  neighborhood: string | null
  latitude: number | null
  longitude: number | null
  apartment_id: number | null
  building_name: string | null
  address: string | null
  unit: string | null
  lifestyle: Lifestyle
  photos: string[]
}
export type FeedItem = { listing: Listing; match: MatchResult }
export type ListingPage = { total: number; items: Listing[] }
export type ListingMatchResponse = { scanned: number; results: FeedItem[] }

export type Profile = {
  budget_max: number
  budget_min: number | null
  move_in: string
  move_out: string | null
  preferred_neighborhoods: string[]
  max_distance_miles: number | null
  lifestyle: Lifestyle
  bio: string
  is_discoverable: boolean
}

export type RoommateCard = {
  user: PublicUser
  bio: string
  budget_max: number
  move_in: string
  move_out: string | null
  preferred_neighborhoods: string[]
  lifestyle: Lifestyle
  match: MatchResult
  personality_summary: string | null
}

export type MapPoint = {
  id: number
  title: string
  monthly_rent: number
  listing_type: ListingType
  latitude: number
  longitude: number
  neighborhood: string | null
  travel: Travel
  photo: string | null
}

export type Message = {
  id: number
  sender_id: number
  is_mine: boolean
  body: string
  created_at: string
}
export type Conversation = {
  id: number
  other: PublicUser
  listing_id: number | null
  listing_title: string | null
  last_message: string | null
  last_message_at: string | null
  unread: number
  can_review: boolean
}
export type ConversationDetail = Conversation & { messages: Message[] }

export type PersonReview = {
  id: number
  relationship_kind: 'roommate' | 'subletter' | 'lister'
  rating: number
  traits: Record<string, number>
  body: string
  created_at: string
  is_mine: boolean
}
export type PersonProfile = {
  user: PublicUser
  review_count: number
  average_rating: number | null
  trait_averages: Record<string, number>
  reviews: PersonReview[]
  can_review: boolean
  my_review: PersonReview | null
}

export type CategoryInsight = {
  category: string
  mentions: number
  positive: number
  negative: number
  mixed: number
  negative_share: number
  is_recurring_issue: boolean
  sample_evidence: string[]
}
export type Insights = {
  sample_size: number
  verified_count: number
  unverified_count: number
  period_start: string | null
  period_end: string | null
  categories: CategoryInsight[]
  recurring_issues: string[]
  median_reported_monthly_cost: number | null
}
export type ExternalInfo = {
  status: 'not_needed' | 'ready' | 'missing' | 'disabled'
  provider: string | null
  sample_size: number | null
  pool_size: number | null
  average_rating: number | null
  fetched_at: string | null
}
export type Building = {
  id: number
  name: string
  address: string
  neighborhood: string | null
  latitude: number | null
  longitude: number | null
  review_count: number
  verified_count: number
  average_rating: number | null
  rating: RatingSummary | null
  listing_count: number
}
export type BuildingDetail = Building & {
  insights_source: 'homie' | 'google' | 'homie_thin' | 'none'
  min_reviews: number
  insights: Insights | null
  summary: string
  external: ExternalInfo
  median_listing_rent: number | null
  my_verification: 'none' | 'pending' | 'approved' | 'rejected'
  my_review_id: number | null
}
export type BuildingReview = {
  id: number
  body: string
  overall_rating: number | null
  lived_from: string | null
  lived_to: string | null
  is_verified_resident: boolean
  created_at: string
  is_mine: boolean
  topics: string[]
}
export type Citation = {
  review_id: number
  quote: string
  is_verified_resident: boolean
  submitted_on: string
}
export type Answer = {
  answer: string
  citations: Citation[]
  sample_size: number
  verified_count: number
  source: 'homie' | 'google' | 'none'
  generated_by: string
}
export type Verification = {
  id: number
  apartment_id: number
  apartment_name: string
  user_display: string
  status: string
  created_at: string
  has_document: boolean
}

export type Understood = {
  summary?: string | null
  budget_max?: number | null
  move_in?: string | null
  move_out?: string | null
  preferred_neighborhoods: string[]
  near_campus: boolean
  max_distance_miles?: number | null
  listing_types: string[]
  sleep_schedule?: 'early' | 'flexible' | 'late' | null
  cleanliness?: number | null
  noise_tolerance?: number | null
  smoking?: boolean | null
  drinking?: boolean | null
  pets?: boolean | null
  diet?: 'veg' | 'non_veg' | null
  must_haves: string[]
  roommate_personality?: Personality | null
}

export type AISearchResponse = {
  understood: Understood
  used_model: boolean
  model: string | null
  note: string | null
  scanned: number
  results: (FeedItem & { why: string; feature_hits: string[] })[]
}
