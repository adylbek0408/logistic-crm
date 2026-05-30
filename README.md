# Logistic CRM

CRM-система для управления логистическими заказами: клиенты, шаблоны накладных, совместное редактирование строк заказа в реальном времени, учёт оплат и генерация PDF-накладных.

---

## О проекте

### Что делает проект?

**Logistic CRM** — веб-приложение для компаний, которые принимают и исполняют заказы от клиентов (магазинов, брендов). Система позволяет:

- вести базу клиентов;
- создавать заказы по настраиваемым шаблонам (количество строк и страниц);
- заполнять строки заказа (товар, количество, цена, статус выполнения);
- работать над одним заказом нескольким сотрудникам одновременно через WebSocket;
- завершать заказы, фиксировать оплату и скачивать PDF-накладную;
- видеть аналитику на дашборде (для владельца).

### Какую проблему решает?

Заменяет бумажные накладные и разрозненные таблицы единой системой, где:

- заказ имеет понятный жизненный цикл (`новый` → `в процессе` → `завершён`);
- прогресс исполнения виден в процентах;
- несколько сотрудников не перезаписывают друг друга благодаря блокировке строк;
- владелец видит выручку и топ клиентов.

### Для кого предназначен?

| Роль | Описание |
|------|----------|
| **Владелец (`owner`)** | Полный доступ: клиенты, шаблоны, сотрудники, оплаты, аналитика, удаление |
| **Сотрудник (`worker`)** | Работа с заказами и клиентами (чтение), без управления оплатой и администрирования |

### Как работает система в целом?

```
┌─────────────┐     REST API (JWT)      ┌──────────────────┐
│  React SPA  │ ◄──────────────────────►│  Django + DRF    │
│  (Vite)     │     WebSocket (JWT)     │  (Daphne ASGI)   │
└─────────────┘ ◄──────────────────────►└────────┬─────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────┐
                    ▼                             ▼                 ▼
              PostgreSQL                      Redis            Celery
           (данные CRM)                  (Channels/Celery)  (PDF async)
```

1. Пользователь входит через `/login`, получает JWT-токены.
2. Frontend загружает данные через REST API (`/api/...`).
3. При открытии заказа устанавливается WebSocket-соединение (`/ws/order/{id}/`) для синхронизации правок строк.
4. PDF генерируется через ReportLab (синхронно при скачивании или асинхронно через Celery).
5. Файлы (PDF, чеки) хранятся в `media/`.

### Основные возможности

- Аутентификация JWT с автоматическим обновлением access-токена
- CRUD клиентов с поиском и фильтрацией
- Шаблоны заказов (строк на странице × страниц)
- Редактор заказа с пагинацией, поиском по строкам, realtime-синхронизацией
- Дашборд со статистикой и выручкой (только для владельца)
- Управление сотрудниками (только для владельца)
- Генерация PDF-накладных на кириллице

---

## Архитектура проекта

### Frontend

Одностраничное приложение (SPA) на **React 18 + Vite**. Маршрутизация — **React Router v7**. Серверное состояние — **TanStack React Query**. Клиентское состояние авторизации — **Zustand**. HTTP-клиент — **Axios** с JWT-интерцепторами. UI — **Tailwind CSS** + собственные компоненты в `frontend/src/components/ui/`.

Сборка деплоится как статика; в production Nginx отдаёт `frontend/dist`, API проксирует на Daphne.

### Backend

**Django 4.2** с **Django REST Framework**. Три приложения в `apps/`:

| Приложение | Назначение |
|------------|------------|
| `accounts` | Пользователи, роли, JWT endpoints |
| `clients` | Клиенты (магазины/бренды) |
| `orders` | Шаблоны, заказы, строки, PDF, WebSocket, дашборд |

Конфигурация — `config/settings.py`, маршруты — `config/urls.py`, ASGI — `config/asgi.py`.

### База данных

**PostgreSQL**. ORM — Django Models (не Prisma). Таблицы:

- `accounts_user` — пользователи с ролями
- `clients_client` — клиенты
- `orders_template` — шаблоны заказов
- `orders_order` — заказы
- `orders_orderrow` — строки заказов

### Авторизация

- **JWT** через `djangorestframework-simplejwt`
- Access-токен: 8 часов, Refresh: 7 дней, ротация refresh-токенов
- Заголовок: `Authorization: Bearer <access_token>`
- WebSocket: JWT в query-параметре `?token=` или в заголовке `Authorization`
- Роли: `IsOwner`, `IsOwnerOrReadOnly` в `apps/accounts/permissions.py`

### API

REST API под префиксом `/api/`. Все endpoints (кроме login) требуют аутентификации. Пагинация: 50 записей на страницу (`PageNumberPagination`).

### Хранение данных

| Тип | Путь / механизм |
|-----|-----------------|
| Реляционные данные | PostgreSQL |
| PDF-накладные | `media/invoices/` |
| Чеки об оплате | `media/receipts/` |
| Статика Django Admin | `staticfiles/` (после `collectstatic`) |
| Кэш/очереди | Redis (`REDIS_URL`) |

### Взаимодействие между сервисами

| Компонент | Роль |
|-----------|------|
| **Daphne** | ASGI-сервер: HTTP + WebSocket |
| **Redis** | Channel layer для WebSocket; брокер Celery |
| **Celery** | Фоновая генерация PDF (`generate_pdf_task`) |
| **Nginx** | Reverse proxy, статика SPA, `/api/`, `/ws/`, `/media/` |

При недоступности Redis WebSocket переключается на `InMemoryChannelLayer` (локальная разработка).

---

## Технологический стек

### Backend

| Технология | Зачем используется |
|------------|-------------------|
| **Python 3** | Язык backend |
| **Django 4.2** | Web-фреймворк, ORM, admin |
| **Django REST Framework** | REST API, сериализаторы, permissions |
| **djangorestframework-simplejwt** | JWT-аутентификация |
| **django-cors-headers** | CORS для SPA на другом origin |
| **PostgreSQL + psycopg2** | Основная БД |
| **Django Channels** | WebSocket для realtime-редактирования |
| **channels-redis** | Redis channel layer |
| **Daphne** | ASGI-сервер |
| **Celery + Redis** | Фоновые задачи (PDF) |
| **ReportLab + Pillow** | Генерация PDF-накладных |
| **python-dotenv** | Загрузка `.env` |

### Frontend

| Технология | Зачем используется |
|------------|-------------------|
| **React 18** | UI-библиотека |
| **Vite 4** | Сборка и dev-сервер с HMR |
| **React Router v7** | Клиентская маршрутизация |
| **TanStack React Query v5** | Кэширование и синхронизация серверного состояния |
| **Zustand** | Глобальное состояние авторизации |
| **Axios** | HTTP-клиент с JWT-интерцепторами |
| **Tailwind CSS 3** | Utility-first стили |
| **Lucide React** | Иконки |
| **date-fns + react-datepicker** | Работа с датами (завершение заказа) |
| **ESLint** | Линтинг JS/JSX |

### DevOps

| Технология | Зачем используется |
|------------|-------------------|
| **Nginx** | Production reverse proxy и SPA |
| **systemd** | Сервисы `daphne`, `celery` |
| **deploy/update.sh** | Скрипт деплоя на сервер |

---

## Структура проекта

```
logistic-crm/
├── config/                     # Конфигурация Django
│   ├── settings.py             # Настройки: БД, JWT, CORS, Redis, Celery
│   ├── urls.py                 # Корневые URL-маршруты
│   ├── asgi.py                 # ASGI: HTTP + WebSocket
│   ├── wsgi.py                 # WSGI (legacy)
│   └── celery.py               # Конфигурация Celery
├── apps/
│   ├── accounts/               # Пользователи и авторизация
│   │   ├── models.py           # User (AbstractUser + role)
│   │   ├── views.py            # Me, Users CRUD
│   │   ├── serializers.py
│   │   ├── permissions.py      # IsOwner, IsOwnerOrReadOnly
│   │   └── urls.py
│   ├── clients/                # Клиенты
│   │   ├── models.py           # Client
│   │   ├── views.py            # List/Create/Detail + orders клиента
│   │   ├── serializers.py
│   │   └── urls.py
│   └── orders/                 # Заказы, шаблоны, PDF, WebSocket
│       ├── models.py           # Template, Order, OrderRow
│       ├── views.py            # REST views + DashboardStats
│       ├── serializers.py
│       ├── consumers.py        # WebSocket OrderConsumer
│       ├── middleware.py       # JWTAuthMiddleware для WS
│       ├── routing.py          # ws/order/{id}/
│       ├── tasks.py            # Celery: generate_pdf_task
│       ├── pdf.py              # ReportLab генератор накладной
│       └── urls.py
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── api/                # axios + endpoints
│   │   ├── components/         # UI и layout
│   │   ├── hooks/              # useOrderWebSocket
│   │   ├── pages/              # Страницы приложения
│   │   ├── store/              # Zustand auth store
│   │   └── utils/              # format, status
│   ├── public/
│   ├── vite.config.js          # Proxy /api → localhost:8000
│   └── package.json
├── deploy/                     # Production конфигурация
│   ├── nginx.conf
│   ├── daphne.service
│   ├── celery.service
│   └── update.sh               # Скрипт обновления на сервере
├── manage.py                   # Django CLI
├── requirements.txt            # Python-зависимости
├── .env.example                # Пример переменных окружения
└── README.md                   # Этот файл
```

| Директория | Назначение |
|------------|------------|
| `config/` | Точка входа Django: settings, routing, ASGI/Celery |
| `apps/accounts/` | Модель пользователя, JWT refresh, CRUD сотрудников |
| `apps/clients/` | Клиенты и их заказы |
| `apps/orders/` | Ядро бизнес-логики: заказы, realtime, PDF, аналитика |
| `frontend/` | React-приложение |
| `deploy/` | Nginx, systemd, скрипт деплоя для production (`mmm.kg`) |
| `media/` | Загружаемые файлы (создаётся при работе) |
| `staticfiles/` | Статика Django (после `collectstatic`) |

---

## Быстрый запуск

### Требования

- Python 3.10+
- Node.js 18+
- PostgreSQL
- Redis (опционально для dev; без Redis WebSocket работает in-memory)

### 1. Клонирование и виртуальное окружение

```bash
git clone <repository-url>
cd logistic-crm
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Переменные окружения

```bash
cp .env.example .env
# Отредактируйте .env — минимум SECRET_KEY, DB_*, DEBUG=True
```

### 3. База данных

```bash
# Создайте БД в PostgreSQL
createdb logistic_crm

# Примените миграции
python manage.py migrate

# Создайте суперпользователя (владелец)
python manage.py createsuperuser
```

> **Seed-данных в проекте нет.** Начальные данные создаются через UI или Django Admin (`/admin/`).

### 4. Запуск backend

```bash
# ASGI-сервер (HTTP + WebSocket)
python manage.py runserver
# или
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Backend доступен на `http://localhost:8000`.

### 5. Запуск Celery (опционально)

```bash
celery -A config.celery worker --loglevel=info
```

### 6. Запуск frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend доступен на `http://localhost:5173`. Vite проксирует `/api` и `/media` на `localhost:8000`.

### 7. Production-сборка frontend

```bash
cd frontend
npm run build
# Результат: frontend/dist/
```

---

## Переменные окружения

### Backend (файл `.env` в корне проекта)

| Переменная | Описание | Пример / default |
|------------|----------|------------------|
| `DEBUG` | Режим отладки Django | `True` (dev) / `False` (prod) |
| `SECRET_KEY` | Секретный ключ Django | `django-insecure-...` (dev) |
| `ALLOWED_HOSTS` | Разрешённые хосты (через запятую) | `localhost,127.0.0.1` |
| `DB_NAME` | Имя базы PostgreSQL | `logistic_crm` |
| `DB_USER` | Пользователь БД | `postgres` |
| `DB_PASSWORD` | Пароль БД | `postgres` |
| `DB_HOST` | Хост БД | `localhost` |
| `DB_PORT` | Порт БД | `5432` |
| `REDIS_URL` | URL Redis для Channels и Celery | `redis://localhost:6379/0` |
| `CORS_ALLOWED_ORIGINS` | Origins для CORS (через запятую) | `http://localhost:5173` |

### Frontend (файл `frontend/.env.development`)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `VITE_API_URL` | Базовый URL backend API | `http://localhost:8000` |
| `VITE_WS_URL` | Базовый URL WebSocket | `ws://localhost:8000` |

> В production при раздаче SPA с того же домена, что и API, `VITE_API_URL` может быть пустым — запросы идут на текущий origin.

---

## Основные функции проекта

### 1. Аутентификация

**Что делает:** вход по логину/паролю, хранение JWT, автоматический refresh при 401.

**Код:**
- Backend: `config/urls.py` (`/api/auth/login/`), `apps/accounts/views.py`
- Frontend: `frontend/src/pages/Login.jsx`, `frontend/src/store/auth.js`, `frontend/src/api/axios.js`

**Логика:** `TokenObtainPairView` выдаёт `access` + `refresh`. Axios-интерцептор при 401 вызывает `/api/auth/refresh/` и повторяет запрос.

---

### 2. Управление клиентами

**Что делает:** список клиентов с поиском, фильтрация по статусу заказов и датам, карточка клиента с заказами и выручкой.

**Код:**
- Backend: `apps/clients/views.py`, `apps/clients/models.py`
- Frontend: `frontend/src/pages/Clients.jsx`, `frontend/src/pages/ClientDetail.jsx`

**Логика:** `Client.display_name` формируется из имени или бренда. При создании заказа выбирается шаблон — автоматически создаются пустые строки (`OrderCreateSerializer.create`).

---

### 3. Шаблоны заказов

**Что делает:** определяет структуру заказа — `rows_per_page × pages = total_rows`.

**Код:**
- Backend: `apps/orders/models.py` (`Template`), `apps/orders/views.py`
- Frontend: `frontend/src/pages/Templates.jsx`

**Логика:** CRUD шаблонов доступен только владельцу (`IsOwner` на POST/PATCH/DELETE).

---

### 4. Редактор заказа (realtime)

**Что делает:** совместное редактирование строк с блокировкой, debounce сохранения, автопереход `new → in_progress`.

**Код:**
- Backend: `apps/orders/consumers.py`, `apps/orders/views.py` (`OrderRowUpdateView`)
- Frontend: `frontend/src/pages/OrderEditor.jsx`, `frontend/src/hooks/useWebSocket.js`

**Логика:**
1. При фокусе на строке отправляется `row:lock` через WebSocket.
2. Изменения сохраняются через REST PATCH и broadcast `row:updated`.
3. Первая правка строки переводит заказ в `in_progress`.
4. При disconnect все блокировки пользователя снимаются.

---

### 5. Завершение заказа и оплата

**Что делает:** перевод в статус `completed`, указание поставщика/покупателя, даты отправки, статуса оплаты.

**Код:**
- Backend: `apps/orders/views.py` (`OrderDetailView.update` — payment fields только для owner)
- Frontend: `frontend/src/pages/OrderEditor.jsx` (модал «Завершение заказа»)

---

### 6. PDF-накладная

**Что делает:** генерирует PDF с кириллицей (ReportLab), только выполненные строки (`fulfillment_status=done`).

**Код:**
- Backend: `apps/orders/pdf.py`, `apps/orders/tasks.py`, `apps/orders/views.py` (`DownloadPDFView`, `GeneratePDFView`)
- Frontend: кнопка PDF в `OrderEditor.jsx`

---

### 7. Дашборд и аналитика

**Что делает:** счётчики заказов по статусам; для владельца — выручка, топ клиентов, график по месяцам.

**Код:**
- Backend: `apps/orders/views.py` (`DashboardStatsView`)
- Frontend: `frontend/src/pages/Dashboard.jsx`

**Логика:** выручка = сумма `quantity × price` для строк со статусом `done`.

---

### 8. Управление сотрудниками

**Что делает:** CRUD пользователей с ролями `owner` / `worker`. Удаление = soft delete (`is_active=False`).

**Код:**
- Backend: `apps/accounts/views.py`, `apps/accounts/models.py`
- Frontend: `frontend/src/pages/Users.jsx`

---

## API Overview

Базовый URL: `/api/`. Аутентификация: `Authorization: Bearer <access_token>`.

### Auth

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth/login/` | Получить JWT-токены |
| POST | `/api/auth/refresh/` | Обновить access-токен |
| GET/PATCH | `/api/auth/me/` | Профиль текущего пользователя |
| GET/POST | `/api/auth/users/` | Список / создание пользователей (owner) |
| GET/PATCH/DELETE | `/api/auth/users/{id}/` | Детали / обновление / деактивация (owner) |

**Пример login:**

```http
POST /api/auth/login/
Content-Type: application/json

{"username": "admin", "password": "secret"}
```

```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Clients

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/clients/` | Список / создание клиента |
| GET/PATCH/DELETE | `/api/clients/{id}/` | Детали / обновление / удаление |
| GET | `/api/clients/{id}/orders/` | Заказы клиента |

**Query-параметры GET `/api/clients/`:** `search`, `order_status`, `date_from`, `date_to`

### Templates

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/templates/` | Список / создание (POST — owner) |
| GET/PATCH/DELETE | `/api/templates/{id}/` | CRUD (изменение — owner) |

### Orders

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/orders/` | Список / создание заказа |
| GET/PATCH/DELETE | `/api/orders/{id}/` | Детали / обновление / удаление |
| PATCH | `/api/orders/{id}/rows/{row_id}/` | Обновление строки заказа |
| POST | `/api/orders/{id}/generate-pdf/` | Асинхронная генерация PDF (Celery) |
| GET | `/api/orders/{id}/download-pdf/` | Скачать PDF (поддержка `?token=`) |

**Query-параметры GET `/api/orders/`:** `status` (`active` = new+in_progress), `client`, `date_from`, `date_to`, `payment_status`

### Dashboard

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/dashboard/stats/` | Статистика заказов и выручки |

**Пример ответа (фрагмент, для owner):**

```json
{
  "total": 42,
  "new": 5,
  "in_progress": 12,
  "completed": 25,
  "total_revenue": 1250000.00,
  "month_revenue": 89000.00,
  "top_clients": [{"id": 1, "name": "...", "brand": "...", "revenue": 50000, "orders_count": 3}],
  "monthly": [{"month": "May 2026", "revenue": 89000.00}]
}
```

### WebSocket

```
ws://host/ws/order/{order_id}/?token={access_token}
```

**События клиент → сервер:** `row:update`, `row:lock`, `row:unlock`, `order:status`

**События сервер → клиент:** `user:joined`, `user:left`, `row:lock`, `row:unlock`, `row:updated`, `order:status`

---

## Дополнительная документация

- [Frontend README](frontend/README.md) — архитектура React-приложения
- [Backend README](backend/README.md) — архитектура Django API

## Production

Production-деплой настроен для `mmm.kg`:

```bash
bash deploy/update.sh
```

Скрипт выполняет: `git pull`, `pip install`, `migrate`, `collectstatic`, `npm ci && npm run build`, restart `daphne`, `celery`, reload `nginx`.
