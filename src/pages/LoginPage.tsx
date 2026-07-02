import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BookOpen } from 'lucide-react'
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
    <main className="login-page">
      <section className="login-panel">
        <div className="login-mark"><BookOpen size={28} /><span>PageTurn Admin</span></div>
        <h1>Catalog and user operations</h1>
        <form onSubmit={handleSubmit((values) => login.mutate(values))}>
          <label>Email
            <input autoComplete="email" {...register('email', { required: 'Email is required' })} />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
          <label>Password
            <input type="password" autoComplete="current-password" {...register('password', { required: 'Password is required' })} />
            {errors.password && <small>{errors.password.message}</small>}
          </label>
          {login.error && <div className="error-box">{login.error.message}</div>}
          <button className="button primary wide" disabled={login.isPending}>
            {login.isPending ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
