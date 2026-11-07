/**
 * People seen online during this browser session. They stay at the top of the offline
 * group after they leave, so the person you were just talking to never disappears behind
 * "Show more". Kept in sessionStorage so a reload keeps the order.
 */
const KEY = 'agentops.seen-online'

export function readSeenOnline(): Set<number> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as number[])
  } catch {
    return new Set()
  }
}

export function rememberOnline(ids: number[]) {
  if (ids.length === 0) return
  try {
    const seen = readSeenOnline()
    const before = seen.size
    for (const id of ids) seen.add(id)
    if (seen.size !== before) sessionStorage.setItem(KEY, JSON.stringify([...seen]))
  } catch {
    // Storage blocked: the list falls back to alphabetical order.
  }
}
