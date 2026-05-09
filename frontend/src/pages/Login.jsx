import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, getMe } from '../api/endpoints'
import useAuthStore from '../store/auth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: storeLogin } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: tokens } = await login(form)
      const { data: user } = await getMe()
      // getMe needs the token set first
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
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
              L
            </div>
            <h1 className="text-2xl font-bold text-primary">Logistic CRM</h1>
            <p className="text-sm text-gray-500 mt-1">Войдите в систему</p>
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
            <Input
              label="Пароль"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            {error && (
              <div className="bg-red-50 border border-red-100 text-danger text-sm rounded-lg px-4 py-2.5">
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
