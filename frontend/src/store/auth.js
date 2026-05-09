import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),

  setUser: (user) => set({ user, isAuthenticated: true }),

  login: (tokens, user) => {
    localStorage.setItem('access_token', tokens.access)
    localStorage.setItem('refresh_token', tokens.refresh)
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false })
  },
}))

export default useAuthStore
