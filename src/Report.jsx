// Month report built on this device: CSV (restorable, every entry) + PDF (readable summary). Nothing is uploaded anywhere.
import { useState } from 'react'
import { sb } from './lib/supabase'
import { inr, mkey, shiftMonth } from './lib/hooks'
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')

async function load(mk) {
  const [t, m, c, p, i] = await Promise.all([
    sb.from('transactions').select('*').eq('month_key', mk).order('occurred_at'),
    sb.from('members').select('id,display_name'), sb.from('categories').select('id,name,parent_id'),
    sb.from('month_plans').select('id').eq('month_key', mk).maybeSingle(), sb.from('income_entries').select('amount_paise').eq('month_key', mk)])
  const al = p.data ? (await sb.from('allocations').select('member_id,category_id,amount_paise').eq('plan_id', p.data.id)).data || [] : []
  const mem = Object.fromEntries((m.data || []).map(x => [x.id, x.display_name])), cat = Object.fromEntries((c.data || []).map(x => [x.id, x]))
  const cname = id => { const x = cat[id]; return x ? (x.parent_id && cat[x.parent_id] ? cat[x.parent_id].name + ' > ' : '') + x.name : '' }
  const raw = t.data || []
  const rows = raw.map(x => ({ date: x.local_date, time: new Date(x.occurred_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), person: mem[x.member_id] || '', for: mem[x.for_member_id] || '',
    category: cname(x.category_id), amount_inr: x.amount_paise / 100, mode: x.mode, note: x.note || '', status: x.status, void_reason: x.void_reason || '' }))
  return { raw, rows, al, mem, cat, cname, income: (i.data || []).reduce((s, x) => s + x.amount_paise, 0) }
}
function saveFile(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove()
}
const toCsv = rows => '\ufeff' + [Object.keys(rows[0] || { date: '' }).join(','), ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')

function printPdf(mk, d) {
  const act = d.raw.filter(x => x.status === 'active'), total = act.reduce((s, x) => s + x.amount_paise, 0)
  const by = fn => Object.entries(act.reduce((a, x) => { const k = fn(x); a[k] = (a[k] || 0) + x.amount_paise; return a }, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, inr(v)])
  const table = (rows, head) => `<table><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td class="${String(c).startsWith('₹') ? 'n' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`
  const bud = d.al.map(a => { const sp = act.filter(x => x.member_id === a.member_id && (x.category_id === a.category_id || d.cat[x.category_id]?.parent_id === a.category_id)).reduce((s, x) => s + x.amount_paise, 0)
    return [d.mem[a.member_id], d.cname(a.category_id), inr(a.amount_paise), inr(sp), sp > a.amount_paise ? 'Over by ' + inr(sp - a.amount_paise) : inr(a.amount_paise - sp) + ' left'] })
  const html = `<html><head><title>FamMoney ${mk}</title><style>body{font:12px Georgia,serif;color:#111;margin:24px}h1{font-size:20px}h2{font-size:14px;margin:18px 0 6px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}td.n{text-align:right}</style></head><body>
    <h1>FamMoney · ${mk}</h1><p>Generated ${new Date().toLocaleString('en-IN')} · Total spent <b>${inr(total)}</b>${d.income ? ` · Income recorded ${inr(d.income)}` : ''}</p>
    <h2>By person</h2>${table(by(x => d.mem[x.member_id] || '?'), ['Person', 'Spent'])}<h2>By category</h2>${table(by(x => d.cname(x.category_id)), ['Category', 'Spent'])}
    ${bud.length ? `<h2>Budgets</h2>${table(bud, ['Person', 'Category', 'Budget', 'Spent', 'Result'])}` : ''}
    <h2>All entries</h2>${table(d.rows.map(r => [r.date, r.time, r.person + (r.for ? ' → ' + r.for : ''), r.category, '₹' + r.amount_inr.toLocaleString('en-IN'), r.mode + (r.status === 'void' ? ' (void)' : '')]), ['Date', 'Time', 'Person', 'Category', 'Amount', 'Mode'])}</body></html>`
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(f)
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close()
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 3000) }, 300)
}

export default function Report() {
  const [mk, setMk] = useState(mkey(new Date())), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const go = async kind => { setBusy(true); setErr(''); try { const d = await load(mk); kind === 'csv' ? saveFile(`FamMoney-${mk}.csv`, toCsv(d.rows), 'text/csv') : printPdf(mk, d) } catch (e) { setErr(e.message) } setBusy(false) }
  return <div className="card"><h2>Month report</h2><p className="muted">Built on this phone from what you are allowed to see. Nothing is uploaded. Keep the CSV as your backup and the PDF to read.</p>
    <select value={mk} onChange={e => setMk(e.target.value)}>{Array.from({ length: 6 }, (_, i) => mkey(shiftMonth(-i))).map(x => <option key={x}>{x}</option>)}</select>
    <button disabled={busy} onClick={() => go('csv')}>Download CSV (every entry)</button><button className="alt" disabled={busy} onClick={() => go('pdf')}>Save as PDF</button>{err && <p className="err">{err}</p>}</div>
}
