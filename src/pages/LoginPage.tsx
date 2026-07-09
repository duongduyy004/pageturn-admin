import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

type LoginForm = { email: string; password: string }

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  })
  const login = useMutation({
    mutationFn: api.login,
    onSuccess: (session) => {
      auth.signIn(session)
      navigate({ to: '/' })
    },
  })

  return (
    <main className="grid min-h-screen place-items-center bg-linear-to-br from-[#eff4ef] to-[#f8f7f1] p-6">
      <section className="w-[min(420px,100%)] rounded-lg border border-[#dfe3dc] bg-white p-7 shadow-[0_18px_60px_rgba(16,35,28,.08)]">
        <div className="mb-4 flex items-center gap-2.5 text-lg font-extrabold text-[#1f6f4a]"><img src="/libra_logo_icon_only.png" alt="Libra" className="h-9 w-9 object-contain" /><span>Libra Admin</span></div>
        <h1 className="m-0 text-[30px] font-bold leading-tight tracking-normal text-[#17211b]">Catalog and user operations</h1>
        <form className="grid gap-3" onSubmit={handleSubmit((values) => login.mutate(values))}>
          <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Email
            <input autoComplete="email" {...register('email', { required: 'Email is required' })} />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
          <label className="grid gap-1.5 font-bold text-[#344239] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded-lg [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#c8d0c8] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-[11px] [&_input:not([type=checkbox])]:py-2.5 [&_input:not([type=checkbox])]:text-[#17211b] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-[#c8d0c8] [&_select]:bg-white [&_select]:px-[11px] [&_select]:py-2.5 [&_select]:text-[#17211b] [&_textarea]:w-full [&_textarea]:rounded-lg [&_textarea]:border [&_textarea]:border-[#c8d0c8] [&_textarea]:bg-white [&_textarea]:px-[11px] [&_textarea]:py-2.5 [&_textarea]:text-[#17211b] [&_small]:font-semibold [&_small]:text-[#a52828]">Password
            <input type="password" autoComplete="current-password" {...register('password', { required: 'Password is required' })} />
            {errors.password && <small>{errors.password.message}</small>}
          </label>
          {login.error && <div className="rounded-lg border border-[#e2b8b8] bg-[#fff1f1] px-3 py-2.5 text-[#922323]">{login.error.message}</div>}
          <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c8d0c8] bg-white px-3.5 py-2.5 text-[#17211b] disabled:cursor-not-allowed disabled:opacity-55 !border-[#1f6f4a] !bg-[#1f6f4a] !text-white w-full" disabled={login.isPending}>
            {login.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
