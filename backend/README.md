# Logistic CRM — Backend

Django REST API для CRM-системы логистических заказов. Документ ориентирован на backend-разработчиков.

> **Расположение кода:** backend не вынесен в отдельную директорию. Исходники находятся в корне репозитория:
> - `config/` — настройки Django, ASGI, Celery, URL routing
> - `apps/` — Django-приложения (`accounts`, `clients`, `orders`)
> - `manage.py` — точка входа CLI

---

## Назначение Backend

Backend обеспечивает:

- **REST API** для SPA (CRUD клиентов, заказов, шаблонов, пользователей);
- **JWT-аутентификацию** с ролевой моделью (owner/worker);
- **WebSocket** для совместного редактирования строк заказа в реальном времени;
- **Генерацию PDF-накладных** (ReportLab);
- **Фоновые задачи** через Celery (async PDF);
- **Аналитику** для дашборда (агрегации по PostgreSQL);
- **Хранение файлов** (PDF, чеки) в `media/`.

Production: ASGI-сервер **Daphne** за **Nginx**, timezone `Asia/Bishkek`, locale `ru-ru`.

---

## Архитектура Backend

Проект следует паттерну **Django REST Framework Generic Views** без отдельного слоя Repository.

```
Request
   ↓
URL Router (config/urls.py → apps/*/urls.py)
   ↓
View (generics.* / APIView)
   ↓
Permission Classes (IsAuthenticated, IsOwner, ...)
   ↓
Serializer (validation + representation)
   ↓
Model (Django ORM)
   ↓
PostgreSQL
```

### Controllers (Views)

Views находятся в `apps/*/views.py`:

| View | Файл | Тип |
|------|------|-----|
| `MeView` | accounts/views.py | RetrieveUpdateAPIView |
| `UserListCreateView`, `UserDetailView` | accounts/views.py | ListCreate / RetrieveUpdateDestroy |
| `ClientListCreateView`, `ClientDetailView`, `ClientOrdersView` | clients/views.py | ListCreate / RetrieveUpdateDestroy / List |
| `TemplateListCreateView`, `TemplateDetailView` | orders/views.py | ListCreate / RetrieveUpdateDestroy |
| `OrderListCreateView`, `OrderDetailView` | orders/views.py | ListCreate / RetrieveUpdateDestroy |
| `OrderRowUpdateView` | orders/views.py | APIView (PATCH) |
| `GeneratePDFView`, `DownloadPDFView` | orders/views.py | APIView |
| `DashboardStatsView` | orders/views.py | APIView (GET) |

### Services

Отдельного service layer **нет**. Бизнес-логика распределена между:
- views (фильтрация queryset, permission checks);
- serializers (`OrderCreateSerializer.create` — bulk create rows);
- consumers (`OrderConsumer._save_row` — WebSocket persist);
- `pdf.py` — генерация PDF;
- `tasks.py` — Celery task.

### Repositories

**Не используются.** Доступ к данным через Django ORM напрямую в views/serializers/consumers.

### Middlewares

**Django middleware** (`config/settings.py`):

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    ...
]
```

**WebSocket middleware** (`apps/orders/middleware.py`):

`JWTAuthMiddleware` — извлекает JWT из query string (`?token=`) или заголовка `Authorization: Bearer`, устанавливает `scope['user']`.

### Routes

**Корневые маршруты** (`config/urls.py`):

```python
path('admin/', admin.site.urls),
path('api/auth/login/', TokenObtainPairView.as_view()),
path('api/auth/', include('apps.accounts.urls')),
path('api/clients/', include('apps.clients.urls')),
path('api/', include('apps.orders.urls')),
```

**WebSocket** (`apps/orders/routing.py`):

```python
re_path(r'^ws/order/(?P<order_id>\d+)/$', OrderConsumer.as_asgi())
```

### DTO / Serializers

DRF Serializers выполняют роль DTO:

| Serializer | Модель | Назначение |
|------------|--------|------------|
| `UserSerializer`, `UserCreateSerializer` | User | CRUD пользователей |
| `MeSerializer` | User | Профиль (+ `is_owner`) |
| `ClientSerializer`, `ClientListSerializer` | Client | CRUD + list с annotate |
| `TemplateSerializer` | Template | CRUD шаблонов |
| `OrderSerializer` | Order | Детали заказа с rows |
| `OrderCreateSerializer` | Order | Создание + bulk rows |
| `OrderUpdateSerializer` | Order | PATCH заказа |
| `OrderListSerializer` | Order | Список с агрегатами |
| `OrderRowSerializer`, `OrderRowUpdateSerializer` | OrderRow | Строки заказа |

### Validators

- Django `AUTH_PASSWORD_VALIDATORS` для паролей;
- `UserCreateSerializer`: `password` min_length=6;
- Model-level: `unique_together = [('order', 'row_number')]` на OrderRow;
- Choice fields: status, payment_status, fulfillment_status, unit, role.

---

## База данных

ORM: **Django Models**. Миграции: `apps/*/migrations/`. Prisma **не используется**.

### Таблица `accounts_user`

Кастомная модель пользователя (`AUTH_USER_MODEL = 'accounts.User'`).

| Поле | Тип | Описание |
|------|-----|----------|
| id | BigAutoField | PK |
| username | CharField(150) | Уникальный логин |
| password | CharField(128) | Хэш пароля |
| role | CharField(10) | `owner` / `worker` |
| full_name | CharField(150) | ФИО |
| phone | CharField(20) | Телефон |
| is_active | Boolean | Soft delete |
| is_superuser | Boolean | Django admin |
| + стандартные поля AbstractUser | | email, last_login, groups, ... |

**Свойство:** `is_owner` → `role == 'owner' or is_superuser`

### Таблица `clients_client`

| Поле | Тип | Описание |
|------|-----|----------|
| id | BigAutoField | PK |
| first_name | CharField(100) | Имя (optional) |
| last_name | CharField(100) | Фамилия (optional) |
| phone | CharField(20) | Телефон |
| brand_name | CharField(200) | Бренд / магазин |
| notes | TextField | Заметки |
| created_at | DateTimeField | auto_now_add |
| updated_at | DateTimeField | auto_now |

**Ordering:** `-created_at`

**Property:** `display_name` — first_name + last_name или brand_name

### Таблица `orders_template`

| Поле | Тип | Описание |
|------|-----|----------|
| id | BigAutoField | PK |
| name | CharField(200) | Название |
| rows_per_page | PositiveIntegerField | Строк на странице (default 10) |
| pages | PositiveIntegerField | Страниц (default 1) |
| created_by_id | FK → User | SET_NULL |
| created_at | DateTimeField | auto_now_add |

**Property:** `total_rows = rows_per_page * pages`

### Таблица `orders_order`

| Поле | Тип | Описание |
|------|-----|----------|
| id | BigAutoField | PK |
| client_id | FK → Client | **CASCADE** |
| template_id | FK → Template | SET_NULL, nullable |
| status | CharField(15) | `new` / `in_progress` / `completed` |
| created_by_id | FK → User | SET_NULL |
| created_at, updated_at | DateTimeField | |
| sent_at | DateTimeField | Дата отправки, nullable |
| payment_status | CharField(10) | `paid` / `unpaid` |
| payment_amount | Decimal(12,2) | nullable |
| payment_receipt | FileField | upload_to=`receipts/` |
| notes | TextField | |
| supplier_name | CharField(200) | Поставщик для PDF |
| buyer_name | CharField(200) | Покупатель для PDF |
| pdf_file | FileField | upload_to=`invoices/` |

**Ordering:** `-created_at`

### Таблица `orders_orderrow`

| Поле | Тип | Описание |
|------|-----|----------|
| id | BigAutoField | PK |
| order_id | FK → Order | CASCADE |
| row_number | PositiveIntegerField | Номер строки в заказе |
| item_name | TextField | Наименование |
| fulfillment_status | CharField(10) | `done` / `failed` / `empty` |
| quantity | Decimal(10,3) | nullable |
| unit | CharField(5) | `kg` / `pcs` / `pack` / `box` |
| price | Decimal(10,2) | nullable |
| updated_at | DateTimeField | auto_now |
| updated_by_id | FK → User | SET_NULL |

**Constraints:**
- `unique_together = [('order', 'row_number')]` — уникальный номер строки в заказе

**Property:** `total = quantity * price` (если оба заданы)

### Связи (ER-диаграмма)

```
User ──< Template (created_by)
User ──< Order (created_by)
User ──< OrderRow (updated_by)

Client ──< Order (CASCADE delete)

Template ──< Order (SET_NULL)

Order ──< OrderRow (CASCADE delete)
```

### Индексы

Явные индексы в миграциях не добавлены — используются стандартные PK/FK индексы Django. Дополнительные индексы можно добавить при необходимости (например, `Order.status`, `Order.created_at`).

---

## Авторизация и безопасность

### JWT

Библиотека: `djangorestframework-simplejwt`

```python
# config/settings.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

| Endpoint | Назначение |
|----------|------------|
| `POST /api/auth/login/` | Получение access + refresh |
| `POST /api/auth/refresh/` | Обновление access по refresh |

### Refresh Token

- Хранится на клиенте (`localStorage`);
- При refresh выдаётся новый access;
- `ROTATE_REFRESH_TOKENS=True` — refresh тоже ротируется.

### OAuth

**Не используется.**

### Permission Classes

```python
# apps/accounts/permissions.py

class IsOwner(BasePermission):
    # request.user.is_owner

class IsOwnerOrReadOnly(BasePermission):
    # GET — все authenticated; POST/PUT/PATCH/DELETE — только owner
```

**Матрица доступа:**

| Ресурс | Worker | Owner |
|--------|--------|-------|
| Clients GET | ✓ | ✓ |
| Clients PATCH/DELETE | ✗ | ✓ |
| Templates GET | ✓ | ✓ |
| Templates POST/PATCH/DELETE | ✗ | ✓ |
| Orders CRUD | ✓ (без payment fields на PATCH) | ✓ |
| Users CRUD | ✗ | ✓ |
| Dashboard revenue fields | ✗ | ✓ |

### WebSocket Auth

`JWTAuthMiddleware` + проверка в `OrderConsumer.connect()`:

```python
if not self.user or not self.user.is_authenticated:
    await self.close(code=4001)
```

### CORS

```python
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:5173').split(',')
CORS_ALLOW_CREDENTIALS = True
```

### CSRF

REST API использует JWT (не session cookies) — CSRF middleware включён для Django Admin.

---

## API Документация

Базовый URL: `/api/`. Все endpoints (кроме login) требуют `Authorization: Bearer <token>`.

Default pagination: 50 items, формат `{ "count", "next", "previous", "results" }`.

---

### POST `/api/auth/login/`

**Описание:** Получение JWT-токенов.

**Request:**
```json
{"username": "admin", "password": "secret123"}
```

**Response 200:**
```json
{"access": "eyJ...", "refresh": "eyJ..."}
```

**Errors:**
- `401` — неверные credentials (`{"detail": "No active account found..."}`)

---

### POST `/api/auth/refresh/`

**Request:**
```json
{"refresh": "eyJ..."}
```

**Response 200:**
```json
{"access": "eyJ...", "refresh": "eyJ..."}
```

---

### GET/PATCH `/api/auth/me/`

**Response GET 200:**
```json
{
  "id": 1,
  "username": "admin",
  "full_name": "Админ",
  "phone": "",
  "role": "owner",
  "is_owner": true,
  "is_superuser": true
}
```

PATCH: можно обновить `full_name`, `phone`.

---

### GET/POST `/api/auth/users/`

**Permission:** IsOwner

**POST Request:**
```json
{
  "username": "worker1",
  "password": "pass123",
  "full_name": "Иван",
  "phone": "+996700000000",
  "role": "worker"
}
```

**Response 201:**
```json
{"id": 2, "username": "worker1", "full_name": "Иван", "phone": "...", "role": "worker", "is_active": true}
```

---

### DELETE `/api/auth/users/{id}/`

**Permission:** IsOwner

Soft delete: `is_active = False`

---

### GET/POST `/api/clients/`

**GET Query params:**
- `search` — по first_name, last_name, brand_name, phone
- `order_status` — фильтр клиентов с заказами данного статуса
- `date_from`, `date_to` — по created_at клиента

**POST Request:**
```json
{"brand_name": "Магазин Айгуль", "first_name": "", "last_name": "", "phone": "", "notes": ""}
```

**Response GET (list item):**
```json
{
  "id": 1,
  "first_name": "",
  "last_name": "",
  "display_name": "Магазин Айгуль",
  "phone": "",
  "brand_name": "Магазин Айгуль",
  "orders_count": 5
}
```

---

### GET/PATCH/DELETE `/api/clients/{id}/`

**PATCH/DELETE Permission:** IsOwner

**Response GET:**
```json
{
  "id": 1,
  "display_name": "...",
  "brand_name": "...",
  "phone": "...",
  "notes": "...",
  "created_at": "2026-05-01T10:00:00Z",
  "orders_count": 5
}
```

---

### GET `/api/clients/{id}/orders/`

**Response item (OrderListSerializer):**
```json
{
  "id": 10,
  "client": 1,
  "client_name": "...",
  "client_brand": "...",
  "status": "in_progress",
  "payment_status": "unpaid",
  "created_at": "...",
  "sent_at": null,
  "rows_count": 20,
  "done_count": 8,
  "order_revenue": 15000.00
}
```

---

### GET/POST `/api/templates/`

**POST Permission:** IsOwner

**POST Request:**
```json
{"name": "Овощи базар", "rows_per_page": 10, "pages": 2}
```

**Response:**
```json
{
  "id": 1,
  "name": "Овощи базар",
  "rows_per_page": 10,
  "pages": 2,
  "total_rows": 20,
  "created_by_name": "Админ",
  "created_at": "..."
}
```

---

### GET/PATCH/DELETE `/api/templates/{id}/`

**Permission (modify):** IsOwner

---

### GET/POST `/api/orders/`

**GET Query params:**
- `status` — `new`, `in_progress`, `completed`, или `active` (new + in_progress)
- `client` — ID клиента
- `date_from`, `date_to`
- `payment_status` — `paid` / `unpaid`

**POST Request:**
```json
{"client": 1, "template": 1, "notes": ""}
```

При указании `template` автоматически создаются `total_rows` пустых OrderRow.

**Response POST 201:**
```json
{"id": 15, "client": 1, "template": 1, "notes": ""}
```

---

### GET/PATCH/DELETE `/api/orders/{id}/`

**GET Response (фрагмент):**
```json
{
  "id": 15,
  "client": 1,
  "client_name": "...",
  "status": "in_progress",
  "template_rows_per_page": 10,
  "template_pages": 2,
  "payment_status": "unpaid",
  "supplier_name": "",
  "buyer_name": "",
  "total_amount": 12500.00,
  "rows": [
    {
      "id": 101,
      "row_number": 1,
      "item_name": "Картофель",
      "fulfillment_status": "done",
      "quantity": "10.000",
      "unit": "kg",
      "price": "50.00",
      "total": "500.00",
      "updated_at": "...",
      "updated_by_name": "Иван"
    }
  ]
}
```

**PATCH Request (owner):**
```json
{
  "status": "completed",
  "payment_status": "paid",
  "sent_at": "2026-05-30T00:00:00Z",
  "supplier_name": "ИП Иванов",
  "buyer_name": "Магазин"
}
```

Worker: поля `payment_status`, `payment_amount`, `payment_receipt` игнорируются на backend.

---

### PATCH `/api/orders/{id}/rows/{row_id}/`

**Request:**
```json
{
  "item_name": "Картофель",
  "fulfillment_status": "done",
  "quantity": "10.000",
  "unit": "kg",
  "price": "50.00"
}
```

**Side effect:** если order.status == `new`, автоматически → `in_progress`.

**Response:** OrderRowSerializer

---

### POST `/api/orders/{id}/generate-pdf/`

Запускает Celery task `generate_pdf_task.delay(order_id)`.

**Response:**
```json
{"status": "generating"}
```

---

### GET `/api/orders/{id}/download-pdf/`

Генерирует PDF синхронно, сохраняет в `media/invoices/`, возвращает файл.

**Auth:** Bearer header или `?token=<access_token>` (для mobile browsers).

**Response:** `application/pdf` (inline)

---

### GET `/api/dashboard/stats/`

**Response (worker):**
```json
{"total": 42, "new": 5, "in_progress": 12, "completed": 25}
```

**Response (owner, дополнительно):**
```json
{
  "total_revenue": 1250000.00,
  "month_revenue": 89000.00,
  "top_clients": [...],
  "monthly": [{"month": "May 2026", "revenue": 89000.00}]
}
```

---

### WebSocket `ws/order/{order_id}/`

**Auth:** `?token=<access_token>`

**Client → Server:**

```json
{"event": "row:lock", "row_id": 101}
{"event": "row:unlock", "row_id": 101}
{"event": "row:update", "row_id": 101, "fields": {"item_name": "...", "fulfillment_status": "done", "quantity": "10", "unit": "kg", "price": "50"}}
{"event": "order:status", "status": "completed"}
```

**Server → Client:**

```json
{"event": "user:joined", "user_id": 1, "user_name": "Иван"}
{"event": "user:left", "user_id": 1, "user_name": "Иван"}
{"event": "row:lock", "row_id": 101, "user_id": 2, "user_name": "Пётр"}
{"event": "row:unlock", "row_id": 101, "user_id": 2}
{"event": "row:updated", "row_id": 101, "fields": {...}, "user_id": 2, "user_name": "Пётр"}
{"event": "order:status", "status": "in_progress", "auto": true}
```

---

## Бизнес-логика

### 1. Создание заказа

1. Пользователь выбирает клиента и шаблон.
2. `OrderCreateSerializer.create()` создаёт `Order` и bulk-создаёт `OrderRow` (row_number 1..N).
3. Статус заказа: `new`, payment: `unpaid`.

### 2. Редактирование строк

1. При первом изменении любой строки (REST или WebSocket) статус заказа → `in_progress`.
2. Строка имеет fulfillment_status: `done` (выполнен), `failed` (не выполнен), `empty` (нету).
3. Выручка считается только по строкам `done` с quantity и price.
4. WebSocket broadcast синхронизирует изменения между клиентами.
5. Row lock предотвращает одновременное редактирование одной строки.

### 3. Завершение заказа

1. Статус → `completed`.
2. Owner может указать payment_status, payment_amount, payment_receipt.
3. supplier_name / buyer_name используются в PDF-накладной.

### 4. PDF-накладная

`apps/orders/pdf.py`:
- Заголовок «НАКЛАДНАЯ», номер, дата sent_at;
- Поставщик / Покупатель;
- Таблица: только строки с `fulfillment_status=done`;
- Итого, прописью (если реализовано в pdf.py);
- Шрифт с кириллицей (Arial/DejaVuSans).

### 5. Удаление клиента

`Order.client` — **CASCADE**: удаление клиента удаляет все его заказы и строки.

### 6. Soft delete пользователя

`UserDetailView.perform_destroy()` → `is_active = False`.

### 7. Аналитика дашборда

`DashboardStatsView`:
- Revenue = SUM(quantity × price) WHERE fulfillment_status='done';
- Top clients — GROUP BY client, ORDER BY revenue DESC, LIMIT 6;
- Monthly — TruncMonth по created_at заказа.

---

## Работа с БД

### Миграции

Django migrations (не Prisma):

```bash
python manage.py makemigrations
python manage.py migrate
```

**История миграций:**

| App | Migration | Изменение |
|-----|-----------|-----------|
| accounts | 0001_initial | User model |
| clients | 0001_initial | Client |
| clients | 0002 | first_name optional |
| orders | 0001_initial | Template, Order, OrderRow |
| orders | 0002 | supplier_name, buyer_name |
| orders | 0003 | Order.client CASCADE (было PROTECT) |

### ORM

Примеры из проекта:

```python
# Annotate для списка заказов
Order.objects.annotate(
    rows_count_ann=Count('rows'),
    done_count_ann=Count('rows', filter=Q(rows__fulfillment_status='done')),
)

# Bulk create строк при создании заказа
OrderRow.objects.bulk_create([
    OrderRow(order=order, row_number=i + 1)
    for i in range(template.total_rows)
])
```

### Seed данные

**В проекте отсутствуют.** Начальные данные:

```bash
python manage.py createsuperuser
# или Django Admin / API
```

---

## Разработка

### Как добавить новый endpoint

**1. Serializer** (если нужен):

```python
# apps/myapp/serializers.py
class MySerializer(serializers.ModelSerializer):
    class Meta:
        model = MyModel
        fields = ['id', 'name']
```

**2. View:**

```python
# apps/myapp/views.py
class MyListView(generics.ListAPIView):
    queryset = MyModel.objects.all()
    serializer_class = MySerializer
    permission_classes = [permissions.IsAuthenticated]
```

**3. URL:**

```python
# apps/myapp/urls.py
urlpatterns = [path('my-items/', MyListView.as_view())]

# config/urls.py
path('api/', include('apps.myapp.urls')),
```

**4. Frontend:** добавить функцию в `frontend/src/api/endpoints.js`.

---

### Как добавить новую таблицу

**1. Model:**

```python
# apps/myapp/models.py
class MyModel(models.Model):
    name = models.CharField(max_length=200)
    class Meta:
        db_table = 'myapp_mymodel'
```

**2. Migration:**

```bash
python manage.py makemigrations myapp
python manage.py migrate
```

**3. Serializer + View + URL** (см. выше).

**4. Admin (опционально):**

```python
# apps/myapp/admin.py
admin.site.register(MyModel)
```

---

### Как добавить новую бизнес-логику

Выберите место по типу логики:

| Тип | Где размещать |
|-----|---------------|
| Валидация входных данных | Serializer (`validate_*`, `create`, `update`) |
| Права доступа | Permission class в `apps/accounts/permissions.py` |
| Фильтрация списков | `get_queryset()` во view |
| Side effects при сохранении | `perform_create/update/destroy()` во view |
| Realtime events | `apps/orders/consumers.py` |
| Фоновые задачи | `apps/orders/tasks.py` + Celery |
| Генерация документов | отдельный модуль (как `pdf.py`) |

**Пример:** auto-transition new → in_progress реализован и в `OrderRowUpdateView.patch()`, и в `OrderConsumer._save_row()`.

---

## Запуск и сервисы

### Development

```bash
# HTTP + WebSocket
python manage.py runserver

# Celery worker
celery -A config.celery worker --loglevel=info
```

### Production (systemd)

| Service | Unit file | Command |
|---------|-----------|---------|
| Daphne | `deploy/daphne.service` | `daphne -b 127.0.0.1 -p 8000 config.asgi:application` |
| Celery | `deploy/celery.service` | `celery -A config.celery worker` |
| Nginx | `deploy/nginx.conf` | proxy `/api/`, `/ws/`, static SPA |

### Deploy script

```bash
bash deploy/update.sh
```

---

## Переменные окружения

См. [корневой README](../README.md#переменные-окружения).

---

## Связанная документация

- [Корневой README](../README.md) — обзор проекта
- [Frontend README](../frontend/README.md) — React SPA
