import { useEffect, useState } from 'react'
export default function Header({ m }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { localStorage.removeItem('fm_wx'); const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t) }, [])
  const h = now.getHours(), hi = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return <div className="hdr"><div><h1>{hi}, {m.display_name}</h1><span className="muted">{m.household.name}</span></div>
    <div className="clock"><b>{now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</b><br /><span className="muted">{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div></div>
}
