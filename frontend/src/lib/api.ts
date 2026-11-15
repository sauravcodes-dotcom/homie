// Empty base URL means same origin: the Vite dev proxy forwards /api to FastAPI.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Could not reach the HOMIE API')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export type Health = {
  status: 'ok' | 'degraded'
  version: string
  database: 'ok' | 'unavailable'
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

export const api = {
  health: () => request<Health>('/api/health'),
  scoreMatch: (seeker: SeekerCriteria, listing: ListingCriteria, signal?: AbortSignal) =>
    request<MatchResult>('/api/matching/score', {
      method: 'POST',
      body: JSON.stringify({ seeker, listing }),
      signal,
    }),
}
