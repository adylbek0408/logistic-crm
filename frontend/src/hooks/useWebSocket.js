import { useEffect, useRef, useCallback } from 'react'

const WS_BASE = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000')

export function useOrderWebSocket(orderId, handlers) {
  const ws = useRef(null)
  const reconnectTimer = useRef(null)
  const backoff = useRef(1000)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token')
    const url = `${WS_BASE}/ws/order/${orderId}/?token=${token}`
    ws.current = new WebSocket(url)

    ws.current.onopen = () => {
      backoff.current = 1000
      handlersRef.current.onConnect?.()
    }

    ws.current.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        handlersRef.current.onMessage?.(data)
      } catch {}
    }

    ws.current.onclose = () => {
      handlersRef.current.onDisconnect?.()
      reconnectTimer.current = setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30000)
        connect()
      }, backoff.current)
    }

    ws.current.onerror = () => {
      ws.current?.close()
    }
  }, [orderId])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      ws.current?.close()
    }
  }, [connect])

  const send = useCallback((data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data))
    }
  }, [])

  return { send }
}
