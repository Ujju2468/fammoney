import { useState } from 'react'
import { useTx, inr, mkey, shiftMonth } from './lib/hooks'
import { useNotes, occursOn, ymdOf, DayPanel } from './Notes.jsx'
const COL = ['#c4ed93', '#7bac7e', '#e0787c', '#6fb7c9', '#e0b36b', '#b48ee0', '#e08fb5', '#9aa3b2']
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const Nav = ({ off, setOff, label }) => <div className="row" style={{ border: 0 }}><button className="alt" style={{ width: 52 }} onClick={() => setOff(off - 1)}>‹</button><b>{label}</b><button className="alt" style={{ width: 52 }} onClick={() => setOff(off + 1)} disabled={off >= 0}>›</button></div>

export function Charts() {
  const [d] = useTx(), [view, setView] = useState('month'), [off, setOff] = useState(0)
  if (!d) return <p className="muted">Loading…</p>
  const base = shiftMonth(off), mk = mkey(base), yr = String(base.getFullYear())
  const inM = d.tx.filter(t => t.month_key === mk), total = inM.reduce((s, t) => s + t.amount_paise, 0)
  const cat = Object.entries(inM.reduce((a, t) => ({ ...a, [t.category_id]: (a[t.category_id] || 0) + t.amount_paise }), {})).sort((a, b) => b[1] - a[1])
  const top = cat.slice(0, 6), other = cat.slice(6).reduce((s, x) => s + x[1], 0), rows = other ? [...top, ['other', other]] : top
  const months = MN.map((_, i) => d.tx.filter(t => t.month_key === `${yr}-${String(i + 1).padStart(2, '0')}`).reduce((s, t) => s + t.amount_paise, 0)), mx = Math.max(1, ...months)
  const cn = id => id === 'other' ? 'Other' : d.cats.find(c => c.id === id)?.name || '…'
  let acc = 0
  return (<><h1>Charts</h1>
    <div className="row" style={{ border: 0 }}><button className={view === 'month' ? '' : 'alt'} onClick={() => setView('month')}>Month</button><button className={view === 'year' ? '' : 'alt'} onClick={() => setView('year')}>Year</button></div>
    <Nav off={off} setOff={setOff} label={view === 'month' ? mk : yr} />
    {view === 'month' ? <div className="card"><svg viewBox="0 0 42 42" width="200" style={{ display: 'block', margin: '0 auto' }}>
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      {rows.map(([id, v], i) => { const p = v / total * 100, el = <circle key={id} cx="21" cy="21" r="15.9155" fill="none" stroke={COL[i]} strokeWidth="6" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={25 - acc} />; acc += p; return el })}
      <text x="21" y="22.5" textAnchor="middle" fontSize="4" fill="#fff">{inr(total)}</text></svg>
      {rows.map(([id, v], i) => <div className="row" key={id}><span><span style={{ color: COL[i] }}>●</span> {cn(id)}</span><span>{inr(v)} · {Math.round(v / total * 100)}%</span></div>)}
      {!total && <p className="muted">No spends in this month.</p>}</div>
      : <div className="card">{months.map((v, i) => <div key={i} style={{ margin: '.5rem 0' }}><div className="row" style={{ border: 0, padding: 0 }}><span>{MN[i]}</span><span>{inr(v)}</span></div><div className="bar"><i style={{ width: `${v ? Math.max(3, v / mx * 100) : 0}%` }} /></div></div>)}</div>}</>)
}

export function Calendar({ m }) {
  const [d] = useTx(), [notes, reloadN] = useNotes(), [off, setOff] = useState(0), [sel, setSel] = useState(ymdOf(new Date()))
  if (!d || !notes) return <p className="muted">Loading…</p>
  const b = shiftMonth(off), mk = mkey(b), n = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate(), lead = b.getDay()
  const y = i => `${mk}-${String(i).padStart(2, '0')}`, day = ds => d.tx.filter(t => t.local_date === ds).reduce((s, t) => s + t.amount_paise, 0)
  const k = p => { const r = p / 100; return r >= 1000 ? (r / 1000).toFixed(r % 1000 ? 1 : 0) + 'k' : Math.round(r) }
  return (<><h1>Calendar</h1><Nav off={off} setOff={setOff} label={b.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} />
    <div className="cal">{'SMTWTFS'.split('').map((x, i) => <span key={i} className="muted">{x}</span>)}
      {Array.from({ length: lead }, (_, i) => <i key={'b' + i} />)}
      {Array.from({ length: n }, (_, i) => { const ds = y(i + 1), v = day(ds); return <div key={i} onClick={() => setSel(ds)} className={(v ? 'has ' : '') + (ds === sel ? 'sel' : '')}><small>{i + 1}{notes.some(x => occursOn(x, ds)) ? ' •' : ''}</small><b>{v ? k(v) : ''}</b></div> })}</div>
    <DayPanel ymd={sel} notes={notes} m={m} reload={reloadN} spent={day(sel)} /></>)
}
