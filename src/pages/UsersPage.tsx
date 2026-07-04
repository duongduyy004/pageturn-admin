import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Edit3, Eye, RefreshCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { DataTable } from '../components/DataTable'
import { Dialog } from '../components/Dialog'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'

type UserForm = { email: string; displayName: string; role: 'USER' | 'ADMIN'; active: boolean }
type Mode = 'view' | 'edit'

export function UsersPage() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [selected, setSelected] = useState<User | null>(null)
  const [mode, setMode] = useState<Mode>('view')
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
      setMode('view')
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  function openDialog(user: User, nextMode: Mode) {
    setSelected(user)
    setMode(nextMode)
    reset(user)
  }

  function closeDialog() {
    setSelected(null)
  }

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { accessorKey: 'email', header: 'Email', cell: (info) => <strong>{info.getValue<string>()}</strong> },
    { accessorKey: 'displayName', header: 'Display name' },
    { accessorKey: 'role', header: 'Role', cell: (info) => <span className="inline-flex items-center rounded-full bg-[#edf5ef] px-[9px] py-1 text-xs font-bold text-[#1f6f4a]">{info.getValue<string>()}</span> },
    { accessorKey: 'active', header: 'Status', cell: (info) => <span className={info.getValue<boolean>() ? "inline-flex items-center rounded-full bg-[#e8f6ed] px-[9px] py-1 text-xs font-bold text-[#1d7d44]" : "inline-flex items-center rounded-full bg-[#f7e9e9] px-[9px] py-1 text-xs font-bold text-[#9d2f2f]"}>{info.getValue<boolean>() ? 'Active' : 'Suspended'}</span> },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2.5">
          <button className="inline-flex items-center gap-1.5 border-0 bg-transparent font-bold text-[#1f6f4a]" onClick={() => openDialog(row.original, 'view')}><Eye size={16} />View</button>
          <button className="inline-flex items-center gap-1.5 border-0 bg-transparent font-bold text-[#1f6f4a]" onClick={() => openDialog(row.original, 'edit')}><Edit3 size={16} />Edit</button>
        </div>
      ),
    },
  ], [])

  return (
    <main className="p-7">
      <div className="mb-[18px] flex items-center justify-between gap-[18px]">
        <div><span className="text-xs font-bold uppercase tracking-normal text-[#66746b]">Accounts</span><h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">Users</h1></div>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" onClick={() => users.refetch()}><RefreshCcw size={16} />Refresh</button>
      </div>
      <div className="mb-3.5 grid grid-cols-[minmax(220px,1fr)_160px_150px] gap-2.5 max-[1000px]:grid-cols-1">
        <label className="relative flex items-center [&_svg]:absolute [&_svg]:left-3 [&_svg]:text-[#66746b] [&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-[#c8d0c8] [&_input]:bg-white [&_input]:py-2.5 [&_input]:pr-[11px] [&_input]:pl-9 [&_input]:text-[#17211b]"><Search size={16} /><input placeholder="Search email or name" value={q} onChange={(e) => { setPage(0); setQ(e.target.value) }} /></label>
        <select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" value={role} onChange={(e) => { setPage(0); setRole(e.target.value) }}>
          <option value="">All roles</option><option value="ADMIN">Admin</option><option value="USER">User</option>
        </select>
        <select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" value={active} onChange={(e) => { setPage(0); setActive(e.target.value) }}>
          <option value="">All statuses</option><option value="true">Active</option><option value="false">Suspended</option>
        </select>
      </div>
      {users.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{users.error.message}</div>}
      <DataTable data={users.data?.content ?? []} columns={columns} emptyLabel={users.isLoading ? 'Loading users...' : 'No users found'} />
      <div className="mt-3 flex items-center justify-end gap-3 text-[#66746b]">
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" disabled={page === 0} onClick={() => setPage((value) => Math.max(value - 1, 0))}>Previous</button>
        <span>Page {page + 1} of {users.data?.totalPages || 1}</span>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" disabled={!users.data || page + 1 >= users.data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>

      <Dialog open={!!selected} title={mode === 'view' ? 'User details' : 'Edit user'} onClose={closeDialog}>
        {selected && mode === 'view' && (
          <>
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2.5 [&_dd]:m-0 [&_dt]:font-bold [&_dt]:text-[#66746b]">
              <dt>Email</dt><dd>{selected.email}</dd>
              <dt>Display name</dt><dd>{selected.displayName}</dd>
              <dt>Role</dt><dd><span className="inline-flex items-center rounded-full bg-[#edf5ef] px-[9px] py-1 text-xs font-bold text-[#1f6f4a]">{selected.role}</span></dd>
              <dt>Status</dt><dd><span className={selected.active ? "inline-flex items-center rounded-full bg-[#e8f6ed] px-[9px] py-1 text-xs font-bold text-[#1d7d44]" : "inline-flex items-center rounded-full bg-[#f7e9e9] px-[9px] py-1 text-xs font-bold text-[#9d2f2f]"}>{selected.active ? 'Active' : 'Suspended'}</span></dd>
              <dt>Created</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              <dt>Updated</dt><dd>{new Date(selected.updatedAt).toLocaleString()}</dd>
            </dl>
            <div className="mt-1 flex flex-wrap gap-2.5">
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" onClick={() => setMode('edit')}><Edit3 size={16} />Edit</button>
            </div>
          </>
        )}
        {selected && mode === 'edit' && (
          <form className="grid gap-3" onSubmit={handleSubmit((values) => update.mutate(values))}>
            <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Email<input {...register('email', { required: 'Email is required' })} />{errors.email && <small>{errors.email.message}</small>}</label>
            <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Display name<input {...register('displayName', { required: 'Display name is required' })} />{errors.displayName && <small>{errors.displayName.message}</small>}</label>
            <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Role<select className="w-full rounded-lg border border-[#c8d0c8] bg-white px-[11px] py-2.5 text-[#17211b]" {...register('role')}><option value="USER">User</option><option value="ADMIN">Admin</option></select></label>
            <label className="flex flex-row items-center gap-[9px] font-bold text-[#344239] [&_input]:w-auto"><input type="checkbox" {...register('active')} />Active account</label>
            {update.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{update.error.message}</div>}
            <div className="mt-1 flex flex-wrap gap-2.5">
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white" disabled={update.isPending}>{update.isPending ? 'Saving...' : 'Save changes'}</button>
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55" type="button" onClick={() => setMode('view')}>Cancel</button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  )
}
