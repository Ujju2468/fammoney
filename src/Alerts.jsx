import { useEffect } from 'react'
import { sb } from './lib/supabase'
import { useData, inr, mkey } from './lib/hooks'
export default function Alerts({ m, members }) {
  const mk = mkey(new Date())
  const [d, reload] = useData(async () => {
    const p = await sb.from('month_plans').select('id').eq('month_key', mk).maybeSingle()
    if (!p.data) return null
    const [a, t, c] = await Promise.all([
      sb.from('allocations').select('member_id,category_id,amount_paise').eq('plan_id', p.data.id),
      sb.from('transactions').select('member_id,category_id,amount_paise').eq('month_key', mk).eq('status', 'active'),
      sb.from('categories').select('id,name,parent_id')])
    return { al: a.data || [], tx: t.data || [], cats: c.data || [] }
  }, [mk])
  useEffect(() => { const i = setInterval(reload, 20000); return () => clearInterval(i) }, [reload])
  if (!d) return null
  const rows = d.al.filter(a => a.amount_paise > 0 && (m.role === 'owner' || a.member_id === m.id)).map(a => {
    const sp = d.tx.filter(t => t.member_id === a.member_id && (t.category_id === a.category_id || d.cats.find(c => c.id === t.category_id)?.parent_id === a.category_id)).reduce((s, t) => s + t.amount_paise, 0)
    return { a, sp, left: a.amount_paise - sp, pct: sp / a.amount_paise }
  }).filter(r => r.pct >= 0.8).sort((x, y) => y.pct - x.pct)
  if (!rows.length) return null
  const nm = id => members.find(x => x.id === id)?.display_name || '', cn = id => d.cats.find(c => c.id === id)?.name || ''
  return <div className="card"><h2>Budget alerts</h2>{rows.map(r => <div className="row" key={r.a.member_id + r.a.category_id}>
    <span>{m.role === 'owner' ? nm(r.a.member_id) + ' · ' : ''}{cn(r.a.category_id)}</span>
    {r.left < 0 ? <b className="err">▲ {inr(-r.left)} over</b> : <b style={{ color: 'var(--accent)' }}>⚠ {Math.round(r.pct * 100)}% used · {inr(r.left)} left</b>}</div>)}</div>
}
