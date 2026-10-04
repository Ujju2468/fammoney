import { useState } from 'react'
import { sb } from './lib/supabase'
import { useData, inr } from './lib/hooks'
import { PinGate } from './Lock.jsx'
const CATS = { savings: 'Savings account', fd: 'Fixed deposit', sip: 'SIP / mutual fund', equity: 'Stocks / equity', gold: 'Gold', ppf: 'PPF / EPF', other: 'Other' }
const COL = ['#c4ed93', '#7bac7e', '#6fb7c9', '#e0b36b', '#b48ee0', '#e08fb5', '#9aa3b2']
export default function Vault({ m, members }) { return <PinGate k="vault" minutes={5} title="Wealth Vault"><Inner m={m} members={members} /></PinGate> }

function Inner({ m, members }) {
  const [d, reload] = useData(async () => (await sb.from('holdings').select('*').order('created_at', { ascending: false })).data || [], [])
  const [f, setF] = useState({ cat: 'savings', name: '', start: new Date().toISOString().slice(0, 10), inv: '', cur: '' }), [err, setErr] = useState(''), [who, setWho] = useState('all')
  if (!d) return <div className="skel" />
  const list = d.filter(h => h.status === 'active' && (who === 'all' || h.member_id === who))
  const inv = list.reduce((s, h) => s + h.invested_paise, 0), cur = list.reduce((s, h) => s + h.current_paise, 0), gain = cur - inv
  const by = Object.entries(list.reduce((a, h) => ({ ...a, [h.category]: (a[h.category] || 0) + h.current_paise }), {})).sort((a, b) => b[1] - a[1])
  const nm = id => members.find(x => x.id === id)?.display_name || ''
  const run = async q => { const { error } = await q; setErr(error ? error.message : ''); reload() }
  const cagr = h => { const days = (Date.now() - new Date(h.start_date)) / 864e5; return days >= 90 && h.invested_paise > 0 ? ((h.current_paise / h.invested_paise) ** (365 / days) - 1) * 100 : null }
  const add = () => { run(sb.from('holdings').insert({ household_id: m.household.id, member_id: m.id, category: f.cat, name: f.name.trim(), start_date: f.start, invested_paise: Math.round(parseFloat(f.inv) * 100), current_paise: Math.round(parseFloat(f.cur || f.inv) * 100) })); setF({ ...f, name: '', inv: '', cur: '' }) }
  let acc = 0
  return (<><h1>🏦 Wealth Vault</h1><p className="muted">Tracking only, not investment advice. Values are what you enter.</p>
    {m.role === 'owner' && <select value={who} onChange={e => setWho(e.target.value)}><option value="all">Everyone</option>{members.filter(x => x.status === 'active' && x.role !== 'dependent').map(x => <option key={x.id} value={x.id}>{x.display_name}</option>)}</select>}
    <div className="card"><div className="row" style={{ border: 0 }}><span className="muted">Invested</span><b>{inr(inv)}</b></div><div className="row" style={{ border: 0 }}><span className="muted">Current value</span><b>{inr(cur)}</b></div>
      <div className="row" style={{ border: 0 }}><span className="muted">Gain / loss</span><b className={gain < 0 ? 'err' : 'ok'}>{gain < 0 ? '▼ ' : '▲ '}{inr(Math.abs(gain))}{inv ? ` (${(gain / inv * 100).toFixed(1)}%)` : ''}</b></div></div>
    {by.length > 0 && <div className="card"><h2>Allocation</h2><svg viewBox="0 0 42 42" width="180" style={{ display: 'block', margin: '0 auto' }}><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--surface-2)" strokeWidth="6" />
      {by.map(([c, v], i) => { const p = v / cur * 100, el = <circle key={c} cx="21" cy="21" r="15.9155" fill="none" stroke={COL[i % 7]} strokeWidth="6" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={25 - acc} />; acc += p; return el })}</svg>
      {by.map(([c, v], i) => <div className="row" key={c}><span><span style={{ color: COL[i % 7] }}>●</span> {CATS[c]}</span><span>{inr(v)} · {Math.round(v / cur * 100)}%</span></div>)}</div>}
    <div className="card"><h2>Holdings</h2>{list.length === 0 && <div className="empty">Nothing added yet.</div>}
      {list.map(h => { const g = h.current_paise - h.invested_paise, c = cagr(h); return <div key={h.id} style={{ margin: '.8rem 0' }}>
        <div className="row" style={{ border: 0, padding: 0 }}><span>{h.name}<br /><span className="muted">{CATS[h.category]} · since {h.start_date}{who === 'all' && m.role === 'owner' ? ` · ${nm(h.member_id)}` : ''}</span></span><b>{inr(h.current_paise)}</b></div>
        <div className="row" style={{ border: 0, padding: 0 }}><span className="muted">Invested {inr(h.invested_paise)}{c !== null ? ` · about ${c.toFixed(1)}%/yr (lump-sum basis)` : ''}</span><span className={g < 0 ? 'err' : 'ok'}>{g < 0 ? '▼' : '▲'} {inr(Math.abs(g))}</span></div>
        {h.member_id === m.id && <span className="muted"><a onClick={() => { const v = parseFloat(prompt('Current value in ₹', h.current_paise / 100)); if (v >= 0) run(sb.from('holdings').update({ current_paise: Math.round(v * 100), version: h.version }).eq('id', h.id)) }}>update value</a> · <a onClick={() => confirm('Mark as closed?') && run(sb.from('holdings').update({ status: 'closed', version: h.version }).eq('id', h.id))}>close</a></span>}</div> })}</div>
    <div className="card"><h2>Add holding</h2><select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input placeholder="Name (e.g. HDFC Flexi SIP)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /><label>Start date</label><input type="date" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} />
      <input inputMode="decimal" placeholder="Amount invested ₹" value={f.inv} onChange={e => setF({ ...f, inv: e.target.value })} /><input inputMode="decimal" placeholder="Current value ₹ (optional)" value={f.cur} onChange={e => setF({ ...f, cur: e.target.value })} />
      <button disabled={!f.name.trim() || !(parseFloat(f.inv) >= 0)} onClick={add}>Save holding</button>{err && <p className="err">{err}</p>}</div></>)
}
