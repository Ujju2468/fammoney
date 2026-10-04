import { useState } from 'react'
import { sb } from './lib/supabase'
import { useData, inr, mkey } from './lib/hooks'
import Report from './Report.jsx'

export default function Plan({ m, members }) {
  const mk = mkey(new Date()), hid = m.household.id, owner = m.role === 'owner'
  const [inc, setInc] = useState(''), [f, setF] = useState({ mem: m.id, cat: '', amt: '' }), [err, setErr] = useState('')
  const [d, reload] = useData(async () => {
    const [p, i, c, t] = await Promise.all([
      sb.from('month_plans').select('id,status,version').eq('month_key', mk).maybeSingle(),
      sb.from('income_entries').select('amount_paise').eq('month_key', mk),
      sb.from('categories').select('id,name,parent_id,archived').order('sort'),
      sb.from('transactions').select('member_id,category_id,amount_paise').eq('month_key', mk).eq('status', 'active')])
    const al = p.data ? (await sb.from('allocations').select('id,member_id,category_id,amount_paise').eq('plan_id', p.data.id)).data : []
    return { plan: p.data, inc: i.data || [], cats: c.data || [], tx: t.data || [], al: al || [] }
  }, [mk])
  const run = async q => { const { error } = await q; setErr(error ? error.message : ''); reload() }
  if (!d) return <div className="skel" />
  const name = id => members.find(x => x.id === id)?.display_name || '…', cname = id => d.cats.find(c => c.id === id)?.name || '…'
  const income = d.inc.reduce((s, x) => s + x.amount_paise, 0), alloc = d.al.reduce((s, x) => s + x.amount_paise, 0)
  return (<>
    <h1>Monthly budget · {mk}</h1>
    {!d.plan ? (owner ? <button onClick={() => run(sb.from('month_plans').insert({ household_id: hid, month_key: mk, status: 'active' }))}>Start this month's budget</button>
      : <p className="muted">The Owners have not set this month's budget yet.</p>) : <>
      <div className="row" style={{ border: 0 }}><span className="pill" style={{ color: d.plan.status === 'closed' ? 'var(--accent)' : 'var(--secondary)' }}>{d.plan.status === 'closed' ? '🔒 Month closed' : 'Month open'}</span>
        {owner && <a onClick={() => { const c = d.plan.status === 'closed'; if (confirm(c ? 'Reopen this month?' : 'Close this month? Nobody can add or edit spends in it.')) run(sb.from('month_plans').update({ status: c ? 'active' : 'closed', version: d.plan.version }).eq('id', d.plan.id)) }}>{d.plan.status === 'closed' ? 'Reopen' : 'Close month'}</a>}</div>
      {m.role !== 'dependent' && <div className="card"><div className="row" style={{ border: 0 }}><span>Income</span><b>{inr(income)}</b></div>
        <div className="row" style={{ border: 0 }}><span>Not yet assigned</span><b className={income - alloc < 0 ? 'err' : 'ok'}>{income - alloc < 0 ? '▲ ' : ''}{inr(income - alloc)}</b></div>
        {owner && <><label>Add salary / income (₹)</label><input inputMode="decimal" value={inc} onChange={e => setInc(e.target.value)} placeholder="40000" />
          <button onClick={() => { const p = Math.round(parseFloat(inc) * 100); if (p > 0) { run(sb.from('income_entries').insert({ household_id: hid, member_id: m.id, amount_paise: p, received_on: new Date().toISOString().slice(0, 10), month_key: mk })); setInc('') } }}>Add income</button></>}
      </div>}
      {owner && <div className="card"><h2>Assign budget</h2>
        <select value={f.mem} onChange={e => setF({ ...f, mem: e.target.value })}>{members.filter(x => x.status === 'active').map(x => <option key={x.id} value={x.id}>{x.display_name}</option>)}</select>
        <select value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}><option value="">Category or group…</option>{d.cats.filter(c => !c.archived).map(c => <option key={c.id} value={c.id}>{c.parent_id ? '\u00a0\u00a0' : ''}{c.name}{d.cats.some(x => x.parent_id === c.id) ? ' (all)' : ''}</option>)}</select>
        <input inputMode="decimal" placeholder="Amount ₹ (e.g. 4000)" value={f.amt} onChange={e => setF({ ...f, amt: e.target.value })} />
        <button disabled={!f.cat || !(parseFloat(f.amt) >= 0)} onClick={() => { run(sb.from('allocations').upsert({ household_id: hid, plan_id: d.plan.id, member_id: f.mem, category_id: f.cat, amount_paise: Math.round(parseFloat(f.amt) * 100) }, { onConflict: 'plan_id,member_id,category_id' })); setF({ ...f, amt: '' }) }}>Save budget</button></div>}
      <h2>Budgets</h2>
      {d.al.length === 0 && <p className="muted">No budgets assigned yet.</p>}
      {d.al.map(a => { const sp = d.tx.filter(t => t.member_id === a.member_id && (t.category_id === a.category_id || d.cats.find(c => c.id === t.category_id)?.parent_id === a.category_id)).reduce((s, t) => s + t.amount_paise, 0), left = a.amount_paise - sp
        return <div className="card" key={a.id}><div className="row" style={{ border: 0 }}><span>{name(a.member_id)} · {cname(a.category_id)}</span>{owner && <a onClick={() => run(sb.from('allocations').delete().eq('id', a.id))} style={{ cursor: 'pointer' }}>✕</a>}</div>
          <div className="row" style={{ border: 0 }}><span className="muted">Spent {inr(sp)} of {inr(a.amount_paise)}</span><b className={left < 0 ? 'err' : 'ok'}>{left < 0 ? `▲ ${inr(-left)} over` : `✓ ${inr(left)} left`}</b></div>
          <div className="bar"><i style={{ width: `${Math.min(100, a.amount_paise ? sp / a.amount_paise * 100 : 100)}%`, background: left < 0 ? 'var(--danger-text)' : 'var(--accent)' }} /></div></div> })}
    </>}
    <Report />
    {err && <p className="err">{err}</p>}</>)
}
