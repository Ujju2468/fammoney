import { useState } from 'react'
import { sb } from './lib/supabase'
import { useData, inr, mkey, shiftMonth } from './lib/hooks'
const MODES = ['upi', 'cash', 'card', 'netbanking', 'autodebit', 'other']
const first = d => `${mkey(d)}-01`
const when = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

export default function Orders({ m, members }) {
  const [d, reload] = useData(async () => {
    const [t, c] = await Promise.all([
      sb.from('transactions').select('id,member_id,for_member_id,category_id,amount_paise,occurred_at,local_date,mode,status,note,version').order('occurred_at', { ascending: false }).limit(2000),
      sb.from('categories').select('id,name,parent_id').order('sort')])
    return { tx: t.data || [], cats: c.data || [] }
  }, [])
  const [f, setF] = useState({ q: '', who: '', cat: '', mode: '', from: first(new Date()), to: '', void: false }), [n, setN] = useState(50)
  if (!d) return <div className="skel" />
  const cat = id => d.cats.find(c => c.id === id), nm = id => members.find(x => x.id === id)?.display_name || '…'
  const label = id => { const c = cat(id); return c ? (c.parent_id ? (cat(c.parent_id)?.name || '') + ' › ' : '') + c.name : '…' }
  const set = p => { setF({ ...f, ...p }); setN(50) }
  const rows = d.tx.filter(t => (f.void || t.status === 'active') && (!f.who || t.member_id === f.who) && (!f.cat || t.category_id === f.cat || cat(t.category_id)?.parent_id === f.cat)
    && (!f.mode || t.mode === f.mode) && (!f.from || t.local_date >= f.from) && (!f.to || t.local_date <= f.to)
    && (!f.q || `${label(t.category_id)} ${nm(t.member_id)} ${t.note || ''}`.toLowerCase().includes(f.q.toLowerCase())))
  const total = rows.filter(t => t.status === 'active').reduce((s, t) => s + t.amount_paise, 0)
  const act = async (t, patch) => { const { error } = await sb.from('transactions').update({ ...patch, version: t.version }).eq('id', t.id); if (error) alert(error.message); reload() }
  const voidTx = t => { const r = prompt('Reason for voiding (min 3 letters)'); if (r && r.length >= 3) act(t, { status: 'void', void_reason: r }) }
  const editTx = t => { const v = parseFloat(prompt('New amount in ₹', t.amount_paise / 100)); if (v > 0) act(t, { amount_paise: Math.round(v * 100) }) }
  return (<><h1>Orders</h1>
    <div className="chips"><button className="alt chip" onClick={() => set({ from: first(new Date()), to: '' })}>This month</button>
      <button className="alt chip" onClick={() => set({ from: first(shiftMonth(-1)), to: `${mkey(shiftMonth(-1))}-31` })}>Last month</button>
      <button className="alt chip" onClick={() => set({ from: '', to: '' })}>All time</button></div>
    <div className="filters"><input placeholder="Search note, category, person" value={f.q} onChange={e => set({ q: e.target.value })} style={{ gridColumn: '1/-1' }} />
      <input type="date" value={f.from} onChange={e => set({ from: e.target.value })} /><input type="date" value={f.to} onChange={e => set({ to: e.target.value })} />
      <select value={f.who} onChange={e => set({ who: e.target.value })}><option value="">Everyone</option>{members.map(x => <option key={x.id} value={x.id}>{x.display_name}</option>)}</select>
      <select value={f.mode} onChange={e => set({ mode: e.target.value })}><option value="">Any mode</option>{MODES.map(x => <option key={x}>{x}</option>)}</select>
      <select value={f.cat} onChange={e => set({ cat: e.target.value })} style={{ gridColumn: '1/-1' }}><option value="">All categories</option>{d.cats.map(c => <option key={c.id} value={c.id}>{label(c.id)}</option>)}</select></div>
    <label><input type="checkbox" style={{ width: 'auto', margin: '0 .5rem 0 0' }} checked={f.void} onChange={e => set({ void: e.target.checked })} />Show voided</label>
    <div className="card"><div className="row" style={{ border: 0 }}><span className="muted">{rows.length} entries</span><b>{inr(total)}</b></div>
      {rows.slice(0, n).map(t => <div className="row" key={t.id} style={{ opacity: t.status === 'void' ? 0.5 : 1 }}>
        <span style={{ textDecoration: t.status === 'void' ? 'line-through' : 'none' }}>{label(t.category_id)}<br /><span className="muted">{nm(t.member_id)}{t.for_member_id ? ` → for ${nm(t.for_member_id)}` : ''} · {when(t.occurred_at)} · {t.mode}{t.note ? ` · ${t.note}` : ''}</span></span>
        <span style={{ textAlign: 'right' }}>{inr(t.amount_paise)}{t.status === 'active' && t.member_id === m.id && <><br /><a className="muted" onClick={() => editTx(t)}>edit</a> · <a className="muted" onClick={() => voidTx(t)}>void</a></>}</span></div>)}
      {rows.length > n && <button className="alt" onClick={() => setN(n + 50)}>Show more</button>}
      {rows.length === 0 && <p className="muted">Nothing matches these filters.</p>}</div></>)
}
