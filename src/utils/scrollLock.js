// Counted body-scroll lock. Modals can overlap (e.g. bill → people list, or a
// receipt viewer on top of a form); a plain set/reset would unlock the page as
// soon as the first one closed.
let locks = 0

export function lockScroll() {
  locks += 1
  document.body.style.overflow = 'hidden'
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) document.body.style.overflow = ''
  }
}
