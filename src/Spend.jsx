import { useEffect, useState, useCallback } from 'react'
import { sb } from './lib/supabase'
import { enqueue, flush, loadQueue, loadFailed, loadCache, saveCache } from './lib/outbox'

const inr = p => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const when = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const monthKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const MODES = ['upi', 'cash', 'card', 'netbanking', 'autodebit', 'other']

export default function Spend({ m, members }) {
  const hid = m.household.id
  const [cats, setCats] = useState([]), [txs, setTxs] = useState([]), [queue, setQueue] = useState([]), [failed, setFailed] = useState([])
  const [online, setOnline] = useState(navigator.onLine), [busy, setBusy] = useState(false), [at, setAt] = useState(null)
  const [open, setOpen] = useState(false), [f, setF] = useState({ amt: '', cat: '', mode: 'upi', forM: '', note: '' }), [err, setErr] = useState('')

  const pull = useCallback(async () => {
    const { data, error } = await sb.from('transactions').select('id,member_id,for_member_id,category_id,amount_paise,occurred_at,month_key,mode,status,version,note')
      .eq('status', 'active').order('occurred_at', { ascending: false }).limit(500)
    if (!error) { setTxs(data); saveCache(data); setAt(new Date()) }
  }, [])
  const sync = useCallback(async () => {
    setBusy(true)
    try { await flush(); setQueue(await loadQueue()); setFailed(await loadFailed()); await pull() } catch { /* offline */ }
    setBusy(false)
  }, [pull])

  useEffect(() => {
    loadCache().then(setTxs); loadQueue().then(setQueue); loadFailed().then(setFailed)
    sb.from('categories').select('id,name,parent_id,archived').order('sort').then(({ data }) => { setCats(data || []); const l = (data || []).find(c => !c.archived && !data.some(x => x.parent_id === c.id)); if (l) setF(x => ({ ...x, cat: l.id })) })
    sync()
    const on = () => { setOnline(true); sync() }, off = () => setOnline(false), vis = () => document.visibilityState === 'visible' && sync()
    addEventListener('online', on); addEventListener('offline', off); document.addEventListener('visibilitychange', vis)
    const ch = sb.channel('tx-' + hid).on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${hid}` }, pull).subscribe()
    return () => { removeEventListener('online', on); removeEventListener('offline', off); document.removeEventListener('visibilitychange', vis); sb.removeChannel(ch) }
  }, [hid, sync, pull])

  const add = async () => {
    const paise = Math.round(parseFloat(f.amt) * 100)
    if (!(paise > 0)) return setErr('Enter an amount above 0')
    setErr('')
    await enqueue({ household_id: hid, member_id: m.id, for_member_id: f.forM || null, category_id: f.cat, amount_paise: paise, mode: f.mode, note: f.note.trim() || null,
      occurred_at: new Date().toISOString(), client_op_id: crypto.randomUUID() })
    setQueue(await loadQueue()); setF(x => ({ ...x, amt: '', forM: '', note: '' })); setOpen(false); sync()
  }

  const voidTx = async t => { const r = prompt('Reason for voiding (min 3 letters)'); if (!r || r.length < 3) return
    const { error } = await sb.from('transactions').update({ status: 'void', void_reason: r, version: t.version }).eq('id', t.id); if (error) alert(error.message); pull() }
  const editTx = async t => { const v = parseFloat(prompt('New amount in ₹', t.amount_paise / 100)); if (!(v > 0)) return
    const { error } = await sb.from('transactions').update({ amount_paise: Math.round(v * 100), version: t.version }).eq('id', t.id); if (error) alert(error.message); pull() }
  const catName = id => cats.find(c => c.id === id)?.name || '…'
  const who = id => members.find(x => x.id === id)?.display_name || '…'
  const pending = queue.map(q => ({ ...q.row, id: q.row.client_op_id, pending: true }))
  const all = [...pending, ...txs].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  const tpl = Object.values(txs.filter(t => t.member_id === m.id).reduce((a, t) => { const k = `${t.category_id}|${t.amount_paise}|${t.mode}`; (a[k] ||= { t, n: 0 }).n++; return a }, {})).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 4)
  const mk = monthKey(new Date().toISOString())
  const month = all.filter(t => (t.month_key || monthKey(t.occurred_at)) === mk)
  const total = month.reduce((s, t) => s + t.amount_paise, 0)
  const byCat = Object.entries(month.reduce((a, t) => ({ ...a, [t.category_id]: (a[t.category_id] || 0) + t.amount_paise }), {})).sort((a, b) => b[1] - a[1])
  const max = byCat[0]?.[1] || 1
  const pill = !online ? 'Offline' : busy ? 'Syncing…' : `Synced ✓ ${at ? at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''}`

  return (<>
    <div className="card">
      <div className="row" style={{ border: 0 }}><span className="muted">Spent this month</span><span className="pill" style={{ color: online ? 'var(--secondary)' : 'var(--accent)' }}>{pill}{queue.length ? ` · ${queue.length} waiting` : ''}</span></div>
      <h1 style={{ fontSize: 'var(--fs-3xl)', margin: 0 }}>{inr(total)}</h1>
      {byCat.length === 0 && <p className="muted">No spends yet this month. Tap + to add one.</p>}
      {byCat.map(([id, v]) => (<div key={id} style={{ margin: '.6rem 0' }}>
        <div className="row" style={{ border: 0, padding: 0 }}><span>{catName(id)}</span><span>{inr(v)}</span></div>
        <div className="bar"><i style={{ width: `${Math.max(4, (v / max) * 100)}%` }} /></div></div>))}
    </div>
    {!open && tpl.length > 0 && <div className="chips">{tpl.map(({ t }) => <button key={t.id} className="alt chip" onClick={() => { setF({ amt: String(t.amount_paise / 100), cat: t.category_id, mode: t.mode, forM: '', note: '' }); setOpen(true) }}>{catName(t.category_id)} · {inr(t.amount_paise)}</button>)}</div>}
    {open ? <div className="card"><h2>New expense</h2>
      <label>Amount (₹)</label><input inputMode="decimal" autoFocus value={f.amt} onChange={e => setF({ ...f, amt: e.target.value })} placeholder="500" />
      <label>Category</label><select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>{cats.filter(g => !g.archived && !g.parent_id).map(g => { const ch = cats.filter(c => c.parent_id === g.id && !c.archived); return ch.length ? <optgroup key={g.id} label={g.name}>{ch.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : <option key={g.id} value={g.id}>{g.name}</option> })}</select>
      <label>Payment mode</label><select value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}>{MODES.map(x => <option key={x}>{x}</option>)}</select>
      <label>Note (optional)</label><input value={f.note} maxLength={200} onChange={e => setF({ ...f, note: e.target.value })} placeholder="e.g. petrol at HP pump" />
      <label>Spent for (optional)</label><select value={f.forM} onChange={e => setF({ ...f, forM: e.target.value })}><option value="">Myself / household</option>{members.filter(x => x.id !== m.id).map(x => <option key={x.id} value={x.id}>{x.display_name}</option>)}</select>
      {err && <p className="err">{err}</p>}
      <button onClick={add}>Save</button><button className="alt" onClick={() => setOpen(false)}>Cancel</button></div>
      : <button onClick={() => setOpen(true)}>+ Add expense</button>}
    {failed.length > 0 && <p className="err">{failed.length} entry(ies) could not be saved: {failed[0].error.includes('month_closed') ? 'this month is closed. Ask an Owner to reopen it.' : failed[0].error}</p>}
    <div className="card full"><h2>Recent activity</h2>
      {all.slice(0, 30).map(t => (<div className="row" key={t.id}>
        <span>{catName(t.category_id)}<br /><span className="muted">{who(t.member_id)}{t.for_member_id ? ` → for ${who(t.for_member_id)}` : ''} · {when(t.occurred_at)}{t.note ? ` · ${t.note}` : ''}{t.pending ? ' · ⏳ waiting to sync' : ''}</span></span>
        <span style={{ textAlign: 'right' }}>{inr(t.amount_paise)}{!t.pending && t.member_id === m.id && <><br /><a className="muted" onClick={() => editTx(t)}>edit</a> · <a className="muted" onClick={() => voidTx(t)}>void</a></>}</span></div>))}
    </div></>)
}
