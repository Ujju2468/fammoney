import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { sb, data } from './lib/supabase'
import Alerts from './Alerts.jsx'
import Spend from './Spend.jsx'
import Plan from './Plan.jsx'
import Family from './Family.jsx'
import Header from './Header.jsx'
import { useNotes, Upcoming } from './Notes.jsx'
import { Charts, Calendar } from './Insights.jsx'
const TABS = [['home', '🏠', 'Home'], ['plan', '🧾', 'Budget'], ['charts', '📊', 'Insights'], ['cal', '📅', 'Calendar'], ['more', '👪', 'Family']]

export default function Shell({ m }) {
  const [tab, setTab] = useState('home'), [members, setMembers] = useState([]), [notes] = useNotes()
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW({ onRegisteredSW: (_u, r) => { if (r) setInterval(() => r.update(), 30 * 60 * 1000) } })
  useEffect(() => { data.members(m.household.id).then(setMembers) }, [m, tab])
  const [cfg, setCfg] = useState(null)
  useEffect(() => { sb.from('app_config').select('min_app_version,maintenance_mode,message').maybeSingle().then(({ data: c }) => setCfg(c)) }, [tab])
  const older = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); return false }
  if (cfg && older(__APP_VERSION__, cfg.min_app_version)) return <div className="wrap narrow"><h1>Update required</h1><p className="muted">A newer version of FamMoney is needed. Your unsynced entries are safe on this phone.</p><button onClick={async () => { await updateServiceWorker(true); location.reload() }}>Update now</button></div>
  return (<div className={'wrap ' + (tab === 'home' ? '' : 'narrow')} style={{ paddingBottom: '6rem' }}>
    {cfg?.maintenance_mode && <div className="card"><b>Maintenance</b><p className="muted">{cfg.message || 'Back shortly.'}</p></div>}
    {need && <div className="card" style={{ borderColor: 'var(--accent)' }}><b>Update available</b><button onClick={() => updateServiceWorker(true)}>Refresh</button></div>}
    {tab === 'home' && <><Header m={m} /><Alerts m={m} members={members} /><Upcoming notes={notes} /><div className="home"><Spend m={m} members={members} /></div></>}
    {tab === 'plan' && <Plan m={m} members={members} />}
    {tab === 'charts' && <Charts />}
    {tab === 'cal' && <Calendar m={m} />}
    {tab === 'more' && <Family m={m} members={members} />}
    <nav className="nav">{TABS.map(([k, i, l]) => <a key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</a>)}</nav></div>)
}
