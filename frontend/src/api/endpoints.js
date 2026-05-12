import api from './axios'

// Auth
export const login = (data) => api.post('/api/auth/login/', data)
export const getMe = () => api.get('/api/auth/me/')

// Clients
export const getClients = (params) => api.get('/api/clients/', { params })
export const getClient = (id) => api.get(`/api/clients/${id}/`)
export const createClient = (data) => api.post('/api/clients/', data)
export const updateClient = (id, data) => api.patch(`/api/clients/${id}/`, data)
export const getClientOrders = (id, params) => api.get(`/api/clients/${id}/orders/`, { params })

// Templates
export const getTemplates = () => api.get('/api/templates/')
export const createTemplate = (data) => api.post('/api/templates/', data)
export const deleteTemplate = (id) => api.delete(`/api/templates/${id}/`)

// Orders
export const getOrders = (params) => api.get('/api/orders/', { params })
export const getOrder = (id) => api.get(`/api/orders/${id}/`)
export const createOrder = (data) => api.post('/api/orders/', data)
export const updateOrder = (id, data) => api.patch(`/api/orders/${id}/`, data, {
  headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {}
})
export const updateOrderRow = (orderId, rowId, data) =>
  api.patch(`/api/orders/${orderId}/rows/${rowId}/`, data)
export const generatePdf = (id) => api.post(`/api/orders/${id}/generate-pdf/`)
export const downloadPdf = (id) =>
  api.get(`/api/orders/${id}/download-pdf/`, { responseType: 'blob' })

// Dashboard
export const getDashboardStats = () => api.get('/api/dashboard/stats/')
