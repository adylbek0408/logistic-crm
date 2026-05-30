# Logistic CRM — Frontend

React SPA для работы с CRM: клиенты, заказы, шаблоны, сотрудники и дашборд. Документ ориентирован на frontend-разработчиков.

---

## Назначение Frontend

Frontend — единственный пользовательский интерфейс системы. Он:

- отображает данные из Django REST API;
- управляет JWT-сессией (login, refresh, logout);
- обеспечивает realtime-редактирование заказов через WebSocket;
- адаптирован под desktop (sidebar) и mobile (bottom navigation).

**Взаимодействие с backend:**

| Протокол | Назначение | Базовый URL |
|----------|------------|-------------|
| REST (Axios) | CRUD, статистика, auth | `VITE_API_URL` или proxy `/api` |
| WebSocket | Синхронизация строк заказа | `VITE_WS_URL/ws/order/{id}/` |

В dev-режиме Vite проксирует `/api` и `/media` на `http://localhost:8000` (см. `vite.config.js`).

---

## Архитектура Frontend

### Структура папок

```
frontend/
├── public/                 # Статические ассеты (manifest, icon)
├── src/
│   ├── api/
│   │   ├── axios.js        # HTTP-клиент + JWT interceptors
│   │   └── endpoints.js    # Все API-функции
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx   # Shell: Sidebar + Outlet
│   │   │   └── Sidebar.jsx     # Навигация desktop/mobile
│   │   └── ui/                 # Переиспользуемые UI-компоненты
│   │       ├── Badge.jsx
│   │       ├── Button.jsx
│   │       ├── DataTable.jsx
│   │       ├── FilterBar.jsx
│   │       ├── Input.jsx
│   │       ├── Modal.jsx
│   │       ├── PageHeader.jsx
│   │       ├── Skeleton.jsx
│   │       ├── StatusPill.jsx
│   │       └── Toast.jsx
│   ├── hooks/
│   │   └── useWebSocket.js     # WebSocket для заказа
│   ├── pages/                  # Страницы (route components)
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Clients.jsx
│   │   ├── ClientDetail.jsx
│   │   ├── Orders.jsx
│   │   ├── OrderEditor.jsx
│   │   ├── Templates.jsx
│   │   └── Users.jsx
│   ├── store/
│   │   └── auth.js             # Zustand: user, tokens
│   ├── utils/
│   │   ├── format.js           # formatDate, formatMoney, initials
│   │   └── status.js           # STATUS_META для заказов
│   ├── App.jsx                 # Router, providers, auth guards
│   ├── main.jsx                # Entry point
│   └── index.css               # Tailwind + глобальные стили
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .env.development
```

### Компоненты

| Компонент | Назначение |
|-----------|------------|
| `Button` | Кнопки с вариантами `primary`, `secondary`, размерами |
| `Input` | Поле ввода с label и ошибкой |
| `Modal` | Модальное окно |
| `PageHeader` | Заголовок страницы + subtitle + actions |
| `FilterBar` | Сворачиваемая панель фильтров |
| `StatusPill` | Бейдж статуса заказа |
| `Skeleton` / `SkeletonCard` | Loading-состояния |
| `Toast` / `ToastProvider` | Уведомления (контекст) |
| `DataTable` | Таблица данных |
| `Badge` | Маленький бейдж (роль пользователя) |

### Layouts

**`AppLayout`** — обёртка для авторизованных страниц:

```jsx
<div className="flex min-h-screen">
  <Sidebar />
  <main><Outlet /></main>
</div>
```

**`Sidebar`** — desktop sidebar (272px) + mobile bottom bar. Пункт «Сотрудники» виден только при `user.is_owner`.

### Pages

Все страницы — function components в `src/pages/`. Маршруты определены в `App.jsx`.

### Hooks

**`useOrderWebSocket(orderId, handlers)`** — подключение к `/ws/order/{id}/?token=...`, auto-reconnect с exponential backoff (1s → 30s max).

Handlers: `onConnect`, `onDisconnect`, `onMessage`.

### Services (API layer)

**`src/api/endpoints.js`** — единая точка для всех HTTP-запросов. Пример:

```javascript
export const getClients = (params) => api.get('/api/clients/', { params })
export const createOrder = (data) => api.post('/api/orders/', data)
```

**`src/api/axios.js`** — настроенный Axios instance:
- request interceptor: добавляет `Authorization: Bearer ...` из `localStorage`;
- response interceptor: при 401 пробует refresh и повторяет запрос.

### State Management

| Инструмент | Область | Файл |
|------------|---------|------|
| **TanStack React Query** | Серверное состояние (clients, orders, stats) | используется в pages |
| **Zustand** | Авторизация (user, isAuthenticated) | `store/auth.js` |
| **React useState/useRef** | Локальный UI (модалки, фильтры, формы) | в каждой page |
| **React Context** | Toast notifications | `components/ui/Toast.jsx` |

> **Примечание:** Redux и RTK Query в проекте **не используются**. Вместо них — TanStack React Query + Zustand.

### Routing

React Router v7, `BrowserRouter`:

| Путь | Компонент | Auth |
|------|-----------|------|
| `/login` | `Login` | Public |
| `/` | `Dashboard` | Required |
| `/clients` | `Clients` | Required |
| `/clients/:id` | `ClientDetail` | Required |
| `/orders` | `Orders` | Required |
| `/orders/:id` | `OrderEditor` | Required |
| `/templates` | `Templates` | Required |
| `/users` | `Users` | Required (owner UI) |

**Guards:**
- `RequireAuth` — редирект на `/login` если нет токена;
- `AuthLoader` — загружает `/api/auth/me/` при наличии токена.

### UI система

- **Tailwind CSS 3** с кастомной темой в `tailwind.config.js`
- Цвета: `primary` (#1E1B4B), `accent` (#F59E0B), `neutral`, `success`, `danger`
- Utility-классы: `page-wrap`, `panel`, `crm-control`, `field-label`, `min-h-touch`
- Шрифт: Inter (system fallback)
- Mobile-first: bottom nav, safe-area insets, responsive grids

---

## Поток данных

### Типичный REST-запрос

```
Пользователь (клик «Сохранить»)
    ↓
UI Component (Clients.jsx)
    ↓
useMutation({ mutationFn: createClient })
    ↓
endpoints.js → api.post('/api/clients/', data)
    ↓
axios.js (добавляет JWT header)
    ↓
Django REST API
    ↓
Response JSON
    ↓
onSuccess → queryClient.invalidateQueries(['clients'])
    ↓
UI перерисовывается с новыми данными
```

### Realtime-редактирование заказа

```
Пользователь редактирует строку в OrderEditor
    ↓
Local state (debounce 500ms) + rowStats (instant summary)
    ↓
Параллельно:
  1. REST PATCH /api/orders/{id}/rows/{row_id}/  (persist)
  2. WebSocket send { event: 'row:update', row_id, fields }
    ↓
OrderConsumer (backend) → broadcast row:updated
    ↓
Другие клиенты: useOrderWebSocket onMessage → обновление cache + flash UI
```

### Авторизация

```
Login form submit
    ↓
POST /api/auth/login/ → tokens в localStorage
    ↓
GET /api/auth/me/ → user в Zustand
    ↓
Navigate to /
    ↓
Все последующие запросы: Bearer token
    ↓
401 → POST /api/auth/refresh/ → retry или logout
```

---

## Основные страницы

### `/login` — Login

| | |
|---|---|
| **Назначение** | Вход в систему |
| **Данные** | Форма username/password |
| **API** | `POST /api/auth/login/`, `GET /api/auth/me/` |

### `/` — Dashboard

| | |
|---|---|
| **Назначение** | Главная: статистика заказов, выручка (owner), последние заказы |
| **Данные** | Счётчики, top clients, monthly revenue, список заказов |
| **API** | `GET /api/dashboard/stats/`, `GET /api/orders/?status=&date_from=&date_to=` |

### `/clients` — Clients

| | |
|---|---|
| **Назначение** | Список клиентов с поиском и фильтрами |
| **Данные** | Карточки клиентов (display_name, brand, orders_count) |
| **API** | `GET /api/clients/`, `POST /api/clients/` |

Query: `search`, `order_status`, `date_from`, `date_to`

### `/clients/:id` — ClientDetail

| | |
|---|---|
| **Назначение** | Карточка клиента, список заказов, создание заказа |
| **Данные** | Client info, orders с прогрессом, revenue |
| **API** | `GET /api/clients/{id}/`, `GET /api/clients/{id}/orders/`, `POST /api/orders/`, `PATCH/DELETE /api/clients/{id}/`, `DELETE /api/orders/{id}/` |

### `/orders` — Orders

| | |
|---|---|
| **Назначение** | Список всех заказов с фильтрами |
| **Данные** | Order cards (status, progress, payment) |
| **API** | `GET /api/orders/`, `GET /api/clients/` (для фильтра) |

Default filter: `status=active` (new + in_progress)

### `/orders/:id` — OrderEditor

| | |
|---|---|
| **Назначение** | Редактор строк заказа, realtime sync, PDF, завершение |
| **Данные** | Order + rows, locks, progress, total amount |
| **API** | `GET/PATCH/DELETE /api/orders/{id}/`, `PATCH /api/orders/{id}/rows/{row_id}/`, WebSocket |
| **Особенности** | Пагинация по template_rows_per_page, поиск строк, mobile cards / desktop table |

### `/templates` — Templates

| | |
|---|---|
| **Назначение** | Управление шаблонами заказов |
| **Данные** | name, rows_per_page, pages, total_rows |
| **API** | `GET/POST /api/templates/`, `PATCH/DELETE /api/templates/{id}/` |

CRUD (кроме чтения) — только для `user.is_owner`.

### `/users` — Users

| | |
|---|---|
| **Назначение** | Управление сотрудниками (видна только owner в Sidebar) |
| **Данные** | username, full_name, phone, role |
| **API** | `GET/POST /api/auth/users/`, `PATCH/DELETE /api/auth/users/{id}/` |

---

## Основные компоненты

### AppLayout

**Назначение:** Layout shell с sidebar и `<Outlet />` для вложенных routes.

**Используется:** обёртка всех protected routes в `App.jsx`.

### Sidebar

**Назначение:** Навигация, отображение текущего пользователя, logout.

**Используется:** внутри `AppLayout`.

**Особенности:** фильтрует `NAV_ALL` по `ownerOnly`; desktop sidebar + mobile bottom bar.

### OrderEditor (page, но ключевой)

**Назначение:** Ядро UX — редактирование заказа.

**Ответственность:**
- `MobileRow` / `TableRow` — inline editing с debounce;
- WebSocket locks и broadcast;
- Instant summary через `rowStats`;
- Modals: завершение, удаление;
- PDF download через URL с token.

**Используется:** route `/orders/:id`.

### PageHeader

**Назначение:** Единообразный заголовок страницы.

**Используется:** Clients, Orders, Templates, Users.

### Modal

**Назначение:** Диалоговые окна (создание, редактирование, подтверждение удаления).

**Используется:** на всех CRUD-страницах.

---

## Управление состоянием

### TanStack React Query

Глобальный `QueryClient` в `App.jsx`:

```javascript
const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})
```

**Query keys (примеры):**

| Key | Данные |
|-----|--------|
| `['stats']` | Dashboard statistics |
| `['clients', params]` | Список клиентов |
| `['client', id]` | Один клиент |
| `['client-orders', id]` | Заказы клиента |
| `['orders', filters]` | Список заказов |
| `['order', id]` | Детали заказа |
| `['templates']` | Шаблоны |
| `['users']` | Сотрудники |

**Mutations:** после успеха вызывают `invalidateQueries` или `setQueryData` для optimistic updates (OrderEditor).

### Zustand (auth)

```javascript
// store/auth.js
{
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  setUser, login, logout
}
```

Токены хранятся в `localStorage`: `access_token`, `refresh_token`.

### React Context (Toast)

`ToastProvider` оборачивает приложение в `App.jsx`. Используется для глобальных уведомлений.

### Local State

- Фильтры, модалки, формы — `useState` в page components;
- Debounce timers, refs — `useRef` в OrderEditor rows;
- Prefetch заказа при hover — `queryClient.prefetchQuery` в Orders/ClientDetail.

---

## Как добавить новую страницу

### Шаг 1. Создайте компонент страницы

```jsx
// src/pages/MyPage.jsx
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../components/ui/PageHeader'

export function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-data'],
    queryFn: () => fetchMyData().then(r => r.data),
  })

  return (
    <div className="page-wrap">
      <PageHeader title="Моя страница" subtitle="..." />
      {/* content */}
    </div>
  )
}
```

### Шаг 2. Добавьте API-функцию (если нужен backend)

```javascript
// src/api/endpoints.js
export const fetchMyData = () => api.get('/api/my-endpoint/')
```

### Шаг 3. Зарегистрируйте маршрут

```jsx
// src/App.jsx
import { MyPage } from './pages/MyPage'

// Внутри <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
<Route path="my-page" element={<MyPage />} />
```

### Шаг 4. Добавьте пункт навигации

```javascript
// src/components/layout/Sidebar.jsx
const NAV_ALL = [
  // ...
  { to: '/my-page', label: 'Моя страница', icon: SomeIcon },
]
```

---

## Как добавить новый API запрос

### Шаг 1. Добавьте функцию в endpoints.js

```javascript
export const updateSomething = (id, data) =>
  api.patch(`/api/something/${id}/`, data)
```

### Шаг 2. Используйте в компоненте

**Query (чтение):**

```javascript
const { data, isLoading, error } = useQuery({
  queryKey: ['something', id],
  queryFn: () => getSomething(id).then(r => r.data),
  enabled: !!id,
})
```

**Mutation (запись):**

```javascript
const qc = useQueryClient()
const mutation = useMutation({
  mutationFn: (data) => createSomething(data),
  onSuccess: () => {
    qc.invalidateQueries(['something'])
  },
})
```

### Шаг 3. Обработка FormData (файлы)

```javascript
export const uploadFile = (id, formData) =>
  api.patch(`/api/orders/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
```

Пример из проекта: завершение заказа в `OrderEditor.jsx`.

---

## Как добавить новый компонент

### Шаг 1. Создайте файл в правильной папке

- Переиспользуемый UI → `src/components/ui/MyComponent.jsx`
- Layout → `src/components/layout/`
- Специфичный для одной страницы → можно оставить в page file или `src/components/`

### Шаг 2. Следуйте конвенциям проекта

```jsx
// src/components/ui/MyComponent.jsx
export function MyComponent({ label, children, className = '' }) {
  return (
    <div className={`panel p-4 ${className}`}>
      {label && <div className="field-label">{label}</div>}
      {children}
    </div>
  )
}
```

- Используйте Tailwind utility-классы проекта: `panel`, `crm-control`, `min-h-touch`
- Named exports (не default)
- Props destructuring

### Шаг 3. Импортируйте в page

```jsx
import { MyComponent } from '../components/ui/MyComponent'
```

---

## Скрипты и конфигурация

```bash
npm run dev      # Dev-сервер на :5173
npm run build    # Production build → dist/
npm run preview  # Preview production build
npm run lint     # ESLint
```

### Переменные окружения

| Variable | Описание |
|----------|----------|
| `VITE_API_URL` | Backend URL (dev: `http://localhost:8000`) |
| `VITE_WS_URL` | WebSocket URL (dev: `ws://localhost:8000`) |

### Vite proxy (dev)

```javascript
// vite.config.js
proxy: {
  '/api': { target: 'http://localhost:8000', changeOrigin: true },
  '/media': { target: 'http://localhost:8000', changeOrigin: true },
}
```

При такой конфигурации в dev можно использовать пустой `VITE_API_URL` и относительные пути `/api/...`.

---

## Связанная документация

- [Корневой README](../README.md) — обзор проекта и API
- [Backend README](../backend/README.md) — Django API и модели
