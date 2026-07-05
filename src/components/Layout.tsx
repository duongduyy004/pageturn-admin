import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { BookOpen, LayoutDashboard, LogOut, Tags, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'

export function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const location = useRouterState({ select: (state) => state.location.pathname })

  if (location === '/login') {
    return <Outlet />
  }

  if (!user || !isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-linear-to-br from-[#eff4ef] to-[#f8f7f1] p-6">
        <section className="w-[min(420px,100%)] rounded-lg border border-[#dfe3dc] bg-white p-7 shadow-[0_18px_60px_rgba(16,35,28,.08)]">
          <h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">PageTurn Admin</h1>
          <p>Sign in with an administrator account to manage catalog books and users.</p>
          <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" to="/login">Sign in</Link>
        </section>
      </main>
    )
  }

  return (
    <div className="min-h-screen pl-[248px] max-[1000px]:pl-0">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[248px] flex-col gap-6 overflow-y-auto bg-[#10231c] px-4 py-6 text-[#f7f7ef] max-[1000px]:static max-[1000px]:h-auto max-[1000px]:w-auto">
        <div className="flex items-center gap-2.5 text-lg font-extrabold"><BookOpen size={24} /><span>PageTurn Admin</span></div>
        <nav className="grid gap-1.5">
          <Link className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white" to="/" activeProps={{ className: "flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white !bg-[#1d3a30] !text-white" }}><LayoutDashboard size={18} />Overview</Link>
          <Link className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white" to="/books" activeProps={{ className: "flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white !bg-[#1d3a30] !text-white" }}><BookOpen size={18} />Books</Link>
          <Link className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white" to="/categories" activeProps={{ className: "flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white !bg-[#1d3a30] !text-white" }}><Tags size={18} />Categories</Link>
          <Link className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white" to="/users" activeProps={{ className: "flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white !bg-[#1d3a30] !text-white" }}><Users size={18} />Users</Link>
        </nav>
        <button className="mt-auto flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-3 py-[11px] text-[#dfe8de] hover:bg-[#1d3a30] hover:text-white" type="button" onClick={signOut}><LogOut size={18} />Sign out</button>
      </aside>
      <div className="min-w-0 max-w-full overflow-x-clip pt-[72px] max-[1000px]:pt-0">
        <header className="fixed left-[248px] right-0 top-0 z-20 flex h-[72px] min-w-0 items-center justify-between gap-4 border-b border-[#dfe3dc] bg-white px-7 max-[1000px]:sticky max-[1000px]:left-0">
          <div className="grid gap-[3px]">
            <span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Administrator</span>
            <strong>{user.displayName}</strong>
          </div>
          <span className="min-w-0 truncate">{user.email}</span>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
