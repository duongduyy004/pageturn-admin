import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit3, RefreshCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable } from '../components/DataTable'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'

type UserForm = { email: string; displayName: string; role: 'USER' | 'ADMIN'; active: boolean }

export function UsersPage() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<UserForm>()

  const users = useQuery({
    queryKey: ['users', { page, q, role, active }],
    queryFn: () => api.listUsers(accessToken!, { page, size: 20, q, role, active }),
    enabled: !!accessToken,
  })

  const update = useMutation({
    mutationFn: (values: UserForm) => api.updateUser(accessToken!, selected!.id, values),
    onSuccess: async (user) => {
      setSelected(user)
      reset(user)
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  function startEdit(user: User) {
    setSelected(user)
    reset(user)
  }

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { accessorKey: 'email', header: 'Email', cell: (info) => <strong>{info.getValue<string>()}</strong> },
    { accessorKey: 'displayName', header: 'Display name' },
    { accessorKey: 'role', header: 'Role', cell: (info) => <span className="pill">{info.getValue<string>()}</span> },
    { accessorKey: 'active', header: 'Status', cell: (info) => <span className={info.getValue<boolean>() ? 'status active' : 'status inactive'}>{info.getValue<boolean>() ? 'Active' : 'Suspended'}</span> },
    { id: 'actions', header: '', enableSorting: false, cell: ({ row }) => <button className="icon-text" onClick={() => startEdit(row.original)}><Edit3 size={16} />Edit</button> },
  ], [])

  return (
    <main className="page split-page">
      <section className="main-column">
        <div className="page-title">
          <div><span className="eyebrow">Accounts</span><h1>Users</h1></div>
          <button className="button" onClick={() => users.refetch()}><RefreshCcw size={16} />Refresh</button>
        </div>
        <div className="filters">
          <label className="search-field"><Search size={16} /><input placeholder="Search email or name" value={q} onChange={(e) => { setPage(0); setQ(e.target.value) }} /></label>
          <select value={role} onChange={(e) => { setPage(0); setRole(e.target.value) }}>
            <option value="">All roles</option><option value="ADMIN">Admin</option><option value="USER">User</option>
          </select>
          <select value={active} onChange={(e) => { setPage(0); setActive(e.target.value) }}>
            <option value="">All statuses</option><option value="true">Active</option><option value="false">Suspended</option>
          </select>
        </div>
        {users.error && <div className="error-box">{users.error.message}</div>}
        <DataTable data={users.data?.content ?? []} columns={columns} emptyLabel={users.isLoading ? 'Loading users...' : 'No users found'} />
        <div className="pager">
          <button className="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}>Previous</button>
          <span>Page {page + 1} of {users.data?.totalPages || 1}</span>
          <button className="button" disabled={!users.data || page + 1 >= users.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      </section>
      <aside className="side-panel">
        <h2>{selected ? 'Edit user' : 'Select a user'}</h2>
        {selected ? (
          <form onSubmit={handleSubmit((values) => update.mutate(values))}>
            <label>Email<input {...register('email', { required: 'Email is required' })} />{errors.email && <small>{errors.email.message}</small>}</label>
            <label>Display name<input {...register('displayName', { required: 'Display name is required' })} />{errors.displayName && <small>{errors.displayName.message}</small>}</label>
            <label>Role<select {...register('role')}><option value="USER">User</option><option value="ADMIN">Admin</option></select></label>
            <label className="check"><input type="checkbox" {...register('active')} />Active account</label>
            {update.error && <div className="error-box">{update.error.message}</div>}
            <button className="button primary wide" disabled={update.isPending}>{update.isPending ? 'Saving...' : 'Save changes'}</button>
          </form>
        ) : <p className="muted">Choose a row to update account details, role, or active status.</p>}
      </aside>
    </main>
  )
}
