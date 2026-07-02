import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { BookOpen, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const location = useRouterState({ select: (state) => state.location.pathname })

  if (location === '/login') {
    return <Outlet />
  }

  if (!user || !isAdmin) {
    return (
      <main className="gate">
        <section>
          <h1>PageTurn Admin</h1>
          <p>Sign in with an administrator account to manage catalog books and users.</p>
          <Link className="button primary" to="/login">Sign in</Link>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><BookOpen size={24} /><span>PageTurn Admin</span></div>
        <nav>
          <Link to="/" activeProps={{ className: 'active' }}><LayoutDashboard size={18} />Overview</Link>
          <Link to="/books" activeProps={{ className: 'active' }}><BookOpen size={18} />Books</Link>
          <Link to="/users" activeProps={{ className: 'active' }}><Users size={18} />Users</Link>
        </nav>
        <button className="nav-button" type="button" onClick={signOut}><LogOut size={18} />Sign out</button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Administrator</span>
            <strong>{user.displayName}</strong>
          </div>
          <span>{user.email}</span>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
