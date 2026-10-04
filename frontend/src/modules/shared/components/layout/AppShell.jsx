import { NavLink, useLocation, useNavigate } from 'react-router'
import { useDispatch, useSelector } from 'react-redux'
import { FiChevronRight, FiHome, FiLogOut, FiMenu, FiMessageCircle, FiMoon, FiSearch, FiSun, FiUser } from 'react-icons/fi'
import { useState } from 'react'
import { clearSession } from '../../../auth/authSlice'
import { useTheme } from '../../../../theme/ThemeProvider'
import NotificationsDropdown from './NotificationsDropdown'
import WorkspaceSearch from './WorkspaceSearch'

const iconMap = { Overview: FiHome, Messages: FiMessageCircle, Profile: FiUser }

const PROFILE_PATH_BY_ROLE = {
  Client: '/client/profile',
  Freelancer: '/freelancer/profile',
  Admin: '/admin/profile',
}

export default function AppShell({ navItems, children }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useSelector((s) => s.auth.currentUser)
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  function handleLogout() { dispatch(clearSession()); navigate('/login') }
  const initials = (user?.name || 'User').split(' ').map((x) => x[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className="app-shell">
      {open && <div className="fixed inset-0 z-40 bg-slate-950/50 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`app-sidebar ${open ? 'drawer-open fixed inset-y-0 left-0 z-50 !flex' : ''}`}>
        <div className="relative z-10 flex items-center gap-3 px-5 py-6">
          <div className="brand-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-black text-white">F</div>
          <div className="brand-name"><p className="text-[15px] font-black tracking-tight">Freelance<span className="text-fuchsia-300">Flow</span></p><p className="text-[10px] uppercase tracking-[.2em] text-slate-500">Work, reimagined</p></div>
        </div>
        <div className="user-meta relative z-10 mx-4 mb-5 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xs font-black text-white">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name}</p><p className="text-xs text-slate-400">{user?.role}</p></div></div>
        </div>
        <nav className="relative z-10 flex-1 space-y-1.5 px-3">
          {navItems.map((item) => { const Icon = item.icon || iconMap[item.label] || FiChevronRight; return <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({isActive}) => `nav-link flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 ${isActive ? 'nav-link-active text-white' : 'hover:bg-white/10 hover:text-white'}`}><Icon size={17}/><span className="nav-label">{item.label}</span>{item.badge ? <span className="nav-label ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">{item.badge}</span>:null}</NavLink> })}
        </nav>
        <div className="sidebar-footer relative z-10 space-y-2 border-t border-white/10 p-3">
          <button onClick={() => navigate('/')} title="Marketplace" className="nav-label flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-400 hover:bg-white/10 hover:text-white"><FiHome/> Marketplace</button>
          <button onClick={handleLogout} title="Log out" aria-label="Log out" className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><FiLogOut/><span className="nav-label">Log out</span></button>
        </div>
      </aside>

      <main className="app-content min-w-0">
        <header className="topbar">
          <div className="flex min-w-0 items-center gap-3"><button className="md:hidden rounded-xl border border-slate-200 bg-white p-2" onClick={() => setOpen(true)}><FiMenu/></button><div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span>Workspace</span><FiChevronRight/><span className="font-semibold text-slate-700">{user?.role}</span></div></div>
          <div className="flex items-center gap-2">
            <WorkspaceSearch user={user} open={searchOpen} onRequestClose={() => setSearchOpen(false)} />
            <button onClick={() => setSearchOpen(v=>!v)} aria-label="Search workspace" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:border-violet-200 hover:text-violet-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"><FiSearch/></button>
            <button onClick={toggleTheme} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title={isDark ? 'Light mode' : 'Dark mode'} className="theme-toggle rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:border-violet-200 hover:text-violet-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">{isDark ? <FiSun/> : <FiMoon/>}</button>
            <NotificationsDropdown userId={user?.userId} />
            <button onClick={() => navigate(PROFILE_PATH_BY_ROLE[user?.role] ?? '/')} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 pr-3 hover:border-violet-200"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-black text-white">{initials}</span><span className="hidden text-xs font-bold text-slate-700 sm:block">{user?.name?.split(' ')[0]}</span></button>
          </div>
        </header>
        <div className="page-bg page-container min-h-[calc(100vh-69px)] px-7 py-7">
          <div key={location.pathname} className="animate-rise mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  )
}
