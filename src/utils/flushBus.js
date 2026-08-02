// Lets AuthContext push pending data to the cloud before signing out
// (signing out wipes the local cache, so anything unsynced would be lost).
let flushFn = null

export function registerFlush(fn) {
  flushFn = fn
  return () => { if (flushFn === fn) flushFn = null }
}

export async function flushNow() {
  try {
    await flushFn?.()
  } catch {
    /* best effort — never block sign-out */
  }
}
