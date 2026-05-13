import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { login, getMe } from '../api/endpoints'
import useAuthStore from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { login: storeLogin } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: tokens } = await login(form)
      localStorage.setItem('access_token', tokens.access)
      localStorage.setItem('refresh_token', tokens.refresh)
      const { data: me } = await getMe()
      storeLogin(tokens, me)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 safe-top safe-bottom">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-panel border border-neutral-200 p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
              L
            </div>
            <h1 className="text-mobile-title md:text-2xl font-bold text-primary">Logistic CRM</h1>
            <p className="text-sm text-neutral-500 mt-1">Войдите в систему</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Логин"
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="admin"
              autoComplete="username"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-neutral-700">Пароль</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full min-h-touch px-3 pr-11 rounded-xl border border-neutral-200 bg-white text-sm transition-colors outline-none hover:border-neutral-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 text-danger text-sm rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
