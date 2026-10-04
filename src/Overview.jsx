import { useEffect } from 'react'
import { sb } from './lib/supabase'
import { useData, inr, mkey } from './lib/hooks'
export default function Overview({ m }) {
  const now = new Date(), mk = mkey(now), left = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
  const [d, reload] = useData(async () => {
    const p = await sb.from('month_plans').select('id').eq('month_key', mk).maybeSingle()
    if (!p.data) return { none: true }
    const [a, t, c] = await Promise.all([
      sb.from('allocations').select('member_id,category_id,amount_paise').eq('plan_id', p.data.id),
      sb.from('transactions').select('member_id,category_id,amount_paise').eq('month_key', mk).eq('status', 'active'),
      sb.from('categories').select('id,parent_id')])
    return { al: a.data || [], tx: t.data || [], cats: c.data || [] }
  }, [mk])
  useEffect(() => { const i = setInterval(reload, 20000); return () => clearInterval(i) }, [reload])
  if (!d) return <div className="skel" />
  if (d.none) return <div className="card empty">No budget for this month yet.<br />{m.role === 'owner' ? 'Open the Budget tab to start one.' : 'An Owner will set it up soon.'}</div>
  const al = d.al.filter(a => m.role === 'owner' || a.member_id === m.id)
  const budget = al.reduce((s, a) => s + a.amount_paise, 0)
  const spent = al.reduce((s, a) => s + d.tx.filter(t => t.member_id === a.member_id && (t.category_id === a.category_id || d.cats.find(c => c.id === t.category_id)?.parent_id === a.category_id)).reduce((x, t) => x + t.amount_paise, 0), 0)
  if (!budget) return <div className="card empty">No budget assigned to {m.role === 'owner' ? 'anyone' : 'you'} yet.</div>
  const pct = spent / budget * 100, p = Math.min(100, pct), over = spent > budget, rem = budget - spent
  return <div className="card hero"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="3.4" />
    <circle cx="18" cy="18" r="15.9155" fill="none" stroke={over ? 'var(--danger-text)' : 'var(--accent)'} strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset="25" />
    <text x="18" y="20" textAnchor="middle" fontSize="6.5" fill="#fff" fontWeight="700">{Math.round(pct)}%</text></svg>
    <div><span className="muted">{m.role === 'owner' ? 'Household budget' : 'Your budget'} · {left} day{left > 1 ? 's' : ''} left</span>
      <h2 className={over ? 'err' : ''}>{over ? `▲ ${inr(-rem)} over` : `✓ ${inr(rem)} left`}</h2>
      <span className="muted">Spent {inr(spent)} of {inr(budget)}{!over && rem > 0 ? ` · about ${inr(Math.floor(rem / left))} a day` : ''}</span></div></div>
}
