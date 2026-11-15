/** Scrolls the page to `top`. Native scrolling is used everywhere: the browser runs it off
 *  the main thread and trackpads already add inertia, so a JavaScript smooth-scroll layer
 *  (previously Lenis) only added lag and turned any main-thread work into scroll jank. */
export function scrollPageTo(top: number, smooth = true) {
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' })
}
