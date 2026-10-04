import { useEffect, useState, useCallback } from 'react'
import { sb } from './supabase'
export const inr = p => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
export const mkey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const shiftMonth = n => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return d }
export function useData(fn, deps) {
  const [d, setD] = useState(null)
  const run = useCallback(() => fn().then(setD).catch(() => {}), deps) // eslint-disable-line
  useEffect(() => { run() }, [run])
  return [d, run]
}
export const useTx = () => useData(async () => {
  const [t, c] = await Promise.all([
    sb.from('transactions').select('category_id,amount_paise,local_date,month_key').eq('status', 'active').limit(5000),
    sb.from('categories').select('id,name,parent_id,archived')])
  return { tx: t.data || [], cats: c.data || [] }
}, [])
