import { useState } from 'react'
import { useTx, inr, mkey, shiftMonth } from './lib/hooks'
import { useNotes, occursOn, ymdOf, DayPanel } from './Notes.jsx'
const COL = ['#c4ed93', '#7bac7e', '#e0787c', '#6fb7c9', '#e0b36b', '#b48ee0', '#e08fb5', '#9aa3b2']
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const Nav = ({ off, setOff, label }) => <div className="row" style={{ border: 0 }}><button className="alt" style={{ width: 52 }} onClick={() => setOff(off - 1)}>‹</button><b>{label}</b><button className="alt" style={{ width: 52 }} onClick={() => setOff(off + 1)} disabled={off >= 0}>›</button></div>

export function Charts() {
  const [d] = useTx(), [view, setView] = useState('month'), [off, setOff] = useState(0), [tbl, setTbl] = useState(false)
  const [rg, setRg] = useState({ from: `${mkey(new Date())}-01`, to: ymdOf(new Date()) })
  if (!d) return <div className="skel" />
  const base = shiftMonth(off), mk = mkey(base), yr = String(base.getFullYear()), prev = mkey(shiftMonth(off - 1))
  const sum = a => a.reduce((s, t) => s + t.amount_paise, 0), group = a => Object.entries(a.reduce((o, t) => ({ ...o, [t.category_id]: (o[t.category_id] || 0) + t.amount_paise }), {})).sort((x, y) => y[1] - x[1])
  const sel = view === 'range' ? d.tx.filter(t => t.local_date >= rg.from && t.local_date <= rg.to) : d.tx.filter(t => t.month_key === mk)
  const total = sum(sel), cat = group(sel), other = cat.slice(6).reduce((s, x) => s + x[1], 0), rows = other ? [...cat.slice(0, 6), ['other', other]] : cat.slice(0, 6)
  const months = MN.map((_, i) => sum(d.tx.filter(t => t.month_key === `${yr}-${String(i + 1).padStart(2, '0')}`))), mx = Math.max(1, ...months)
  const cn = id => id === 'other' ? 'Other' : d.cats.find(c => c.id === id)?.name || '…'
  const pv = d.tx.filter(t => t.month_key === prev), pt = sum(pv), pg = group(pv), diff = total - pt
  const move = cat.map(([id, v]) => [id, v - (pg.find(x => x[0] === id)?.[1] || 0)]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 3)
  let acc = 0
  return (<><h1>Insights</h1>
    <div className="chips">{[['month', 'Month'], ['year', 'Year'], ['range', 'Custom range']].map(([k, l]) => <button key={k} className={'chip' + (view === k ? '' : ' alt')} onClick={() => setView(k)}>{l}</button>)}
      <label style={{ marginLeft: 'auto' }}><input type="checkbox" style={{ width: 'auto', margin: '0 .4rem 0 0', minHeight: 0 }} checked={tbl} onChange={e => setTbl(e.target.checked)} />Table view</label></div>
    {view === 'range' ? <div className="filters"><input type="date" value={rg.from} onChange={e => setRg({ ...rg, from: e.target.value })} /><input type="date" value={rg.to} onChange={e => setRg({ ...rg, to: e.target.value })} /></div>
      : <Nav off={off} setOff={setOff} label={view === 'month' ? mk : yr} />}
    {view === 'year' ? <div className="card">{tbl ? <table><thead><tr><th>Month</th><th className="n">Spent</th></tr></thead><tbody>{months.map((v, i) => <tr key={i}><td>{MN[i]}</td><td className="n">{inr(v)}</td></tr>)}</tbody></table>
      : months.map((v, i) => <div key={i} style={{ margin: '.5rem 0' }}><div className="row" style={{ border: 0, padding: 0 }}><span>{MN[i]}</span><span>{inr(v)}</span></div><div className="bar"><i style={{ width: `${v ? Math.max(3, v / mx * 100) : 0}%` }} /></div></div>)}</div>
      : <><div className="card">{tbl ? <table><thead><tr><th>Category</th><th className="n">Spent</th><th className="n">Share</th></tr></thead><tbody>{rows.map(([id, v]) => <tr key={id}><td>{cn(id)}</td><td className="n">{inr(v)}</td><td className="n">{Math.round(v / total * 100)}%</td></tr>)}<tr><td><b>Total</b></td><td className="n"><b>{inr(total)}</b></td><td /></tr></tbody></table>
        : <><svg viewBox="0 0 42 42" width="200" style={{ display: 'block', margin: '0 auto' }}><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
          {rows.map(([id, v], i) => { const p = v / total * 100, el = <circle key={id} cx="21" cy="21" r="15.9155" fill="none" stroke={COL[i]} strokeWidth="6" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={25 - acc} />; acc += p; return el })}
          <text x="21" y="22.5" textAnchor="middle" fontSize="4" fill="#fff">{inr(total)}</text></svg>
          {rows.map(([id, v], i) => <div className="row" key={id}><span><span style={{ color: COL[i] }}>●</span> {cn(id)}</span><span>{inr(v)} · {Math.round(v / total * 100)}%</span></div>)}</>}
        {!total && <div className="empty">No spending in this period.</div>}</div>
      {view === 'month' && pt > 0 && <div className="card"><h2>Compared with {prev}</h2>
        <p style={{ margin: 0 }} className={diff > 0 ? 'err' : 'ok'}>{diff > 0 ? '▲ Up' : diff < 0 ? '▼ Down' : '= Same'} {inr(Math.abs(diff))} ({Math.round(Math.abs(diff) / pt * 100)}%) · last month {inr(pt)}</p>
        {move.map(([id, v]) => <div className="row" key={id}><span>{cn(id)}</span><span className={v > 0 ? 'err' : 'ok'}>{v > 0 ? '▲' : '▼'} {inr(Math.abs(v))}</span></div>)}</div>}</>}</>)
}

export function Calendar({ m }) {
  const [d] = useTx(), [notes, reloadN] = useNotes(), [off, setOff] = useState(0), [sel, setSel] = useState(ymdOf(new Date()))
  if (!d || !notes) return <div className="skel" />
  const b = shiftMonth(off), mk = mkey(b), n = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate(), lead = b.getDay()
  const y = i => `${mk}-${String(i).padStart(2, '0')}`, day = ds => d.tx.filter(t => t.local_date === ds).reduce((s, t) => s + t.amount_paise, 0)
  const k = p => { const r = p / 100; return r >= 1000 ? (r / 1000).toFixed(r % 1000 ? 1 : 0) + 'k' : Math.round(r) }
  return (<><h1>Calendar</h1><Nav off={off} setOff={setOff} label={b.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} />
    <div className="cal">{'SMTWTFS'.split('').map((x, i) => <span key={i} className="muted">{x}</span>)}
      {Array.from({ length: lead }, (_, i) => <i key={'b' + i} />)}
      {Array.from({ length: n }, (_, i) => { const ds = y(i + 1), v = day(ds); return <div key={i} onClick={() => setSel(ds)} className={(v ? 'has ' : '') + (ds === sel ? 'sel' : '')}><small>{i + 1}{notes.some(x => occursOn(x, ds)) ? ' •' : ''}</small><b>{v ? k(v) : ''}</b></div> })}</div>
    <DayPanel ymd={sel} notes={notes} m={m} reload={reloadN} spent={day(sel)} cats={d.cats} /></>)
}
