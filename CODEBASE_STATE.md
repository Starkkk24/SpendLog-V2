# SpendLog-V2 — Codebase State

_Generated 2026-08-15._ Snapshot of current repo state (branch `main`). This file documents structure and implementation as they exist now; re-generate after significant changes rather than hand-editing stale sections.

## 1. Directory Structure & Key Files

```
SpendLog-V2/
├── backend/                       # Django REST API
│   ├── accounts/                  # Only Django app; owns auth + domain models
│   │   ├── models.py              # Contact, Transaction, TransactionSplit
│   │   ├── serializers.py         # DRF ModelSerializers
│   │   ├── views.py                # Function/class-based views (no ViewSets/routers)
│   │   ├── admin.py                # Admin registrations for all 3 models
│   │   ├── migrations/0001_initial.py
│   │   └── tests.py                # empty (default stub)
│   ├── backend/                    # Project config package
│   │   ├── settings.py             # INSTALLED_APPS, REST_FRAMEWORK, CORS, middleware
│   │   ├── urls.py                 # All routes declared flat (no per-app urls.py)
│   │   ├── asgi.py / wsgi.py
│   ├── manage.py
│   ├── requirements.txt
│   ├── db.sqlite3                  # Local dev DB (SQLite, not Postgres despite psycopg2 dep)
│   └── venv/                       # Local virtualenv (not committed dependency source of truth)
│
├── frontend/                       # Next.js 16 (App Router) + TypeScript
│   ├── app/
│   │   ├── page.tsx                 # Landing page: Login/Signup buttons
│   │   ├── layout.tsx                # Root layout, Geist fonts
│   │   ├── (auth)/login/page.tsx     # Login form → services/auth.login()
│   │   ├── (auth)/signup/page.tsx    # Signup form → raw fetch() (not using api.ts/services layer)
│   │   └── (main)/dashboard/page.tsx # Protected page: calls getProtectedData(), logout()
│   ├── lib/api.ts                    # Axios instance + JWT request/response interceptors
│   ├── services/auth.ts              # login(), logout(), getProtectedData() — wraps lib/api.ts
│   ├── components/                   # empty — no shared components yet
│   ├── hooks/                        # empty
│   ├── types/                        # empty — no shared TS types yet
│   ├── utils/                        # empty
│   ├── AGENTS.md / CLAUDE.md          # Note: pinned to a non-standard/future Next.js build; instructs reading node_modules/next/dist/docs before writing Next.js code
│   ├── package.json
│   └── next.config.ts / tsconfig.json / eslint.config.mjs
│
├── .env                              # Root-level env file (not inspected/committed content here)
└── README.md                         # Effectively empty placeholder
```

**Notable gaps:** no `expenses`/`transactions` Django app or DRF endpoints wired up yet despite `Transaction`/`TransactionSplit` models existing; frontend `components/hooks/types/utils` directories are scaffolded but empty; signup page bypasses the shared Axios client.

## 2. Django: Models, Endpoints, Serializers

Single app `accounts` (`backend/accounts/`) handles both auth and domain data.

### Models (`models.py`)

| Model | Fields | Relations / Constraints |
|---|---|---|
| `Contact` | `name` (CharField 100), `created_at` (auto) | `owner` → `User` (PROTECT, related_name `contacts`); unique together `(owner, name)` |
| `Transaction` | `total_amount` (Decimal 10,2), `note` (Text, blank), `transaction_datetime`, `created_at` (auto) | `paid_by` → `Contact` (PROTECT, related_name `transactions_paid`) |
| `TransactionSplit` | `signed_amount` (Decimal 10,2) | `transaction` → `Transaction` (PROTECT, related_name `splits`); `contact` → `Contact` (PROTECT, related_name `transaction_splits`); unique together `(transaction, contact)` |

Auth relies on Django's built-in `User` model — no custom user model or profile.

### Serializers (`serializers.py`)

- `ContactSerializer` — `ModelSerializer`, `fields="__all__"`, `owner` read-only (set server-side from `request.user`)
- `TransactionSerializer` — `ModelSerializer`, `fields="__all__"` (no read-only owner scoping since Transaction has no direct owner FK)
- `TransactionSplitSerializer` — `ModelSerializer`, `fields="__all__"`

`Transaction` and `TransactionSplit` serializers exist but **no views/endpoints use them yet**.

### Endpoints (`backend/backend/urls.py` + `accounts/views.py`)

All routes are flat, declared directly in the project `urls.py` (no DRF router, no per-app `urls.py`, no viewsets):

| Method | Path | View | Auth | Notes |
|---|---|---|---|---|
| POST | `/login/` | `LoginAPI` (APIView) | none | Authenticates via `django.contrib.auth.authenticate`, issues SimpleJWT access+refresh |
| POST | `/signup/` | `SignupAPI` (APIView) | none | Creates `User` via `create_user`; 400 if username taken |
| GET | `/protected/` | `protected_view` (function, `@api_view`) | JWT required | Sanity-check endpoint returning username |
| POST | `/refresh/` | `TokenRefreshView` (SimpleJWT built-in) | none | Standard token refresh |
| POST | `/logout/` | `LogoutAPI` (APIView) | none (token passed in body) | Blacklists refresh token (`token_blacklist` app installed) |
| GET, POST | `/contacts/` | `contact_list` (function, `@api_view`) | JWT required | GET lists contacts scoped to `request.user`; POST creates, forces `owner=request.user` |
| GET, PATCH, DELETE | `/contacts/<int:pk>/` | `contact_detail` (function, `@api_view`) | JWT required | Scoped via `get_object_or_404(Contact, id=pk, owner=request.user)` — cross-user access returns 404 |
| — | `/admin/` | Django admin | staff | `Contact`, `Transaction`, `TransactionSplit` all registered |

No endpoints exist yet for `Transaction` or `TransactionSplit` — only `Contact` is exposed over the API.

### Settings highlights (`backend/settings.py`)

- `rest_framework` + `rest_framework_simplejwt` (+ `token_blacklist`) installed; DRF default auth class is JWT only
- `corsheaders` installed as first middleware entry
- No custom `DEFAULT_PERMISSION_CLASSES` set globally — permissions enforced per-view via `@permission_classes`

## 3. Next.js Frontend: Pages, Components, API Integration

**Stack:** Next.js 16 (App Router, route groups `(auth)`/`(main)`), React 19, TypeScript, Tailwind CSS v4. No component library; all styling is inline Tailwind classes. `components/`, `hooks/`, `types/`, `utils/` directories exist but are currently empty (no shared abstractions yet — every page is self-contained).

### Pages

- **`app/page.tsx`** — Landing page (client component). Two buttons routing to `/login` and `/signup` via `useRouter`.
- **`app/(auth)/login/page.tsx`** — Client component; controlled form (username/password), calls `services/auth.login()`, redirects to `/dashboard` on success, `alert()` on failure.
- **`app/(auth)/signup/page.tsx`** — Client component; controlled form, but calls the backend directly with a raw `fetch()` to `http://127.0.0.1:8000/signup/` instead of going through `lib/api.ts` or `services/auth.ts` — inconsistent with the rest of the app's API layer.
- **`app/(main)/dashboard/page.tsx`** — Client component; on mount calls `getProtectedData()`, redirects to `/login` on failure (acts as the de-facto auth guard — no middleware-based route protection); renders a logout button wired to `services/auth.logout()`.
- **`app/layout.tsx`** — Root layout; Geist/Geist Mono fonts, generic metadata (still default "Create Next App" title/description — not customized).

### API Integration Layer

- **`lib/api.ts`** — Axios instance (`baseURL: http://127.0.0.1:8000/`, hardcoded, no env var).
  - Request interceptor: attaches `Authorization: Bearer <access>` from `localStorage`.
  - Response interceptor: on 401 (and not already retried), pulls `refresh` from `localStorage`, calls `/refresh/` with a **plain** (non-interceptor) Axios instance to avoid recursion, stores new `access`, retries the original request. On refresh failure, clears tokens and hard-redirects to `/login`.
- **`services/auth.ts`** — Thin wrapper over `lib/api.ts`:
  - `login(username, password)` → POST `/login/`, persists `access`/`refresh` to `localStorage`
  - `logout()` → POST `/logout/` with refresh token, clears `localStorage` regardless of outcome
  - `getProtectedData()` → GET `/protected/`

No token storage abstraction beyond direct `localStorage` calls (repeated in multiple places), no React context/hook for auth state, and no typed API response models (`types/` is empty).

## 4. Current Package Dependencies

### Frontend (`frontend/package.json`)

**Dependencies**
- `axios` ^1.18.1
- `next` 16.2.4
- `react` / `react-dom` 19.2.4

**Dev Dependencies**
- `typescript` ^5, `@types/node` ^20, `@types/react` ^19, `@types/react-dom` ^19
- `tailwindcss` ^4, `@tailwindcss/postcss` ^4
- `eslint` ^9, `eslint-config-next` 16.2.4

No test framework, no state management library, no UI kit, no form library installed.

### Backend (`backend/requirements.txt`)

```
asgiref==3.11.1
Django==6.0.4
django-cors-headers==4.9.0
djangorestframework==3.17.1
psycopg2-binary==2.9.12
python-dotenv==1.2.2
sqlparse==0.5.5
```

**Discrepancy:** `djangorestframework-simplejwt` (v5.5.1, confirmed installed in `backend/venv`) is used throughout `settings.py`/`views.py` but is **missing from `requirements.txt`** — a fresh `pip install -r requirements.txt` would not install it and the app would fail to start.

`psycopg2-binary` is listed but the project currently runs against SQLite (`db.sqlite3`, default `settings.py` DB config) — Postgres isn't actually wired up yet despite the dependency being present.
