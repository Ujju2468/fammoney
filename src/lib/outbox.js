// Offline-first outbox (blueprint FEA-012 / ARC-002): save on the device first, send when online, never double-count (RUL-013).
import { get, set } from 'idb-keyval'
import { sb } from './supabase'
const Q = 'fm_outbox', F = 'fm_failed', C = 'fm_cache'
export const loadQueue = async () => (await get(Q)) || []
export const loadFailed = async () => (await get(F)) || []
export const loadCache = async () => (await get(C)) || []
export const saveCache = rows => set(C, rows)
export async function enqueue(row) { const q = await loadQueue(); q.push({ row }); await set(Q, q) }
let running = null
export function flush() {
  if (running) return running
  running = (async () => {
    const q = await loadQueue(), failed = await loadFailed()
    while (q.length) {
      const { error } = await sb.from('transactions').upsert(q[0].row, { onConflict: 'member_id,client_op_id', ignoreDuplicates: true })
      if (error) {
        if (!navigator.onLine || /fetch|network|timeout/i.test(error.message)) break   // offline: keep, retry later
        failed.push({ ...q[0], error: error.message })                                // rejected by the server: park it, don't block the rest
      }
      q.shift()
    }
    await set(Q, q); await set(F, failed)
  })().finally(() => { running = null })
  return running
}
