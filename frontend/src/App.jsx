import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Clients } from './pages/Clients'
import { ClientDetail } from './pages/ClientDetail'
import { Orders } from './pages/Orders'
import { OrderEditor } from './pages/OrderEditor'
import { Templates } from './pages/Templates'
import { Users } from './pages/Users'
import { ToastProvider } from './components/ui/Toast'
import useAuthStore from './store/auth'
import { useEffect } from 'react'
import { getMe } from './api/endpoints'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AuthLoader({ children }) {
  const { isAuthenticated, setUser, user } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && !user) {
      getMe().then((r) => setUser(r.data)).catch(() => {})
    }
  }, [isAuthenticated])

  return children
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
      <BrowserRouter>
        <AuthLoader>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="clients/:id" element={<ClientDetail />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderEditor />} />
              <Route path="templates" element={<Templates />} />
              <Route path="users" element={<Users />} />
            </Route>
          </Routes>
        </AuthLoader>
      </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
