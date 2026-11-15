import type { Listing } from './api'

/* The listing a card was showing when it was clicked. The detail page renders its hero from
   this right away, in the same commit as the navigation, so the card photo can morph into the
   hero (React <ViewTransition>) instead of the page flashing a skeleton first. */
const peeks = new Map<number, Listing>()

export const rememberListing = (l: Listing) => peeks.set(l.id, l)
export const peekListing = (id: number) => peeks.get(id) ?? null

/** View transition name shared by a listing's card photo and its detail hero. */
export const photoName = (id: number) => `listing-photo-${id}`
