import { useState } from 'react'
import { sb } from './lib/supabase'
import { useData, inr } from './lib/hooks'
export const useNotes = () => useData(async () => (await sb.from('day_notes').select('*').order('note_date')).data || [], [])
export const ymdOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const occursOn = (n, y) => n.repeat === 'monthly' ? y >= n.note_date && y.slice(8) === n.note_date.slice(8)
  : n.repeat === 'yearly' ? y >= n.note_date && y.slice(5) === n.note_date.slice(5) : n.note_date === y
const ICON = { note: '📝', reminder: '⏰', bill: '🧾', autopay: '🔁' }

export function Upcoming({ notes }) {
  if (!notes) return null
  const days = Array.from({ length: 8 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymdOf(d) })
  const items = days.flatMap(y => notes.filter(n => !n.done && n.kind !== 'note' && occursOn(n, y)).map(n => ({ n, y })))
  if (!items.length) return null
  return <div className="card"><h2>Coming up</h2>{items.map(({ n, y }) => <div className="row" key={n.id + y}>
    <span>{ICON[n.kind]} {n.title}<br /><span className="muted">{y === days[0] ? 'Today' : new Date(y + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span></span>
    <span>{n.amount_paise ? inr(n.amount_paise) : ''}</span></div>)}</div>
}

export function DayPanel({ ymd, notes, m, reload, spent }) {
  const [f, setF] = useState({ title: '', kind: 'reminder', amt: '', repeat: 'none' }), [err, setErr] = useState('')
  const run = async q => { const { error } = await q; setErr(error ? error.message : ''); reload() }
  const add = () => { run(sb.from('day_notes').insert({ household_id: m.household.id, member_id: m.id, note_date: ymd, title: f.title.trim(), kind: f.kind, amount_paise: f.amt ? Math.round(parseFloat(f.amt) * 100) : null, repeat: f.repeat })); setF({ ...f, title: '', amt: '' }) }
  return <div className="card"><h2>{new Date(ymd + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
    <p className="muted">Spent that day: {inr(spent)}</p>
    {notes.filter(n => occursOn(n, ymd)).map(n => <div className="row" key={n.id}>
      <span style={{ textDecoration: n.done ? 'line-through' : 'none' }}>{ICON[n.kind]} {n.title}{n.repeat !== 'none' ? <span className="pill"> {n.repeat}</span> : null}{n.amount_paise ? ` · ${inr(n.amount_paise)}` : ''}</span>
      {n.member_id === m.id && <span>{n.repeat === 'none' && <a onClick={() => run(sb.from('day_notes').update({ done: !n.done, version: n.version }).eq('id', n.id))}>{n.done ? 'undo' : 'done'}</a>} · <a onClick={() => run(sb.from('day_notes').delete().eq('id', n.id))}>delete</a></span>}</div>)}
    <label>Add to this day</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Electricity bill last date" />
    <select value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}><option value="reminder">Reminder</option><option value="bill">Bill due</option><option value="autopay">Autopay</option><option value="note">Note</option></select>
    <select value={f.repeat} onChange={e => setF({ ...f, repeat: e.target.value })}><option value="none">Does not repeat</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select>
    <input inputMode="decimal" value={f.amt} onChange={e => setF({ ...f, amt: e.target.value })} placeholder="Amount ₹ (optional)" />
    <button disabled={!f.title.trim()} onClick={add}>Save</button>{err && <p className="err">{err}</p>}</div>
}
