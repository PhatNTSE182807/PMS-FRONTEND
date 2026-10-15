# PMS Frontend

Frontend of the Parking Management System (OJT), built with React 19, Vite and TypeScript.

- **Driver app** (`/login`, `/register`, `/me`): the original cyber-themed screens.
- **Admin dashboard** (`/admin/*`, role `Admin`):
  - Staff account management (`/admin/staff`)
  - Revenue report (`/admin/revenue`)
  - Live parking capacity (`/admin/capacity`)

See [docs/ADMIN_DASHBOARD_PLAN.md](docs/ADMIN_DASHBOARD_PLAN.md) for how this frontend compares with the dashboard spec and the backend, and for the path to microservices.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Get started

```sh
npm install
cp .env.example .env.local   # optional, see "Configuration"
npm run dev
```

No backend? Use the demo buttons on the login screen:

- **Instant Access Demo** opens the driver dashboard.
- **Admin Demo** opens the admin dashboard.

Both run entirely on mock data.

## Available scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server. |
| `npm run typecheck` | Type-checks the project (`tsc -b`). |
| `npm run lint` | Lints JS/TS with ESLint. |
| `npm run build` | Type-checks, then creates a production build in `dist/`. |
| `npm run preview` | Serves the production build locally. |

## Configuration

Copy `.env.example` to `.env.local` (git-ignored) and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://localhost:44391/api` | Root of the REST API: today the PMS.API monolith, later the API gateway. |
| `VITE_USE_MOCK_DATA` | `false` | `true` serves **every** service from in-browser mock data. |
| `VITE_MOCK_SERVICES` | `staff,parking,reports` | Services that use mock data even when the flag above is off. These have no backend endpoints yet. |

Service keys:

- `auth`: login and register
- `profile`: driver profile and vehicles
- `staff`: admin staff accounts
- `parking`: lots and occupancy
- `reports`: revenue

When a backend endpoint ships, remove its key from `VITE_MOCK_SERVICES`. No UI code changes.

In development, the API status badge in the header can override the base URL at runtime.

## Architecture

```
pages/ ─► hooks/ (React Query) ─► api/*.service.ts ─► api/axiosClient.ts ─► REST API / gateway
                                        └─ mocks/*.mock.ts when the service is mocked
types/*.dto.ts — contracts shared by every layer, mirroring the backend DTOs
```

| Folder | Layer | Rule |
| --- | --- | --- |
| `src/pages`, `src/components` | Presentation | UI only; never calls HTTP directly. |
| `src/hooks` | Application | React Query hooks: caching, loading, errors, invalidation. |
| `src/types` | Contracts | DTOs matching the backend use cases. IDs are strings. |
| `src/api` | Infrastructure | One client per bounded context (identity, profile, parking, report). |
| `src/mocks` | Infrastructure | Deterministic mock "backends" with 500 ms latency. |
| `src/config`, `src/lib` | Shared | Env/service paths, session store, formatters, domain rules. |

Key decisions:

- **One HTTP client** (`api/axiosClient.ts`). It is the only code that knows the response envelope. It accepts both the current `ApiResult<T> { succeeded, result, errors[] }` and the spec's `ApiResponse<T> { isSuccess, data, errors[{ code, description }] }`. Every failure becomes a typed `ApiError`, and a 401 clears the session.
- **Service paths in one map** (`config/env.ts` → `SERVICE_PATHS`). Moving a bounded context to its own microservice, or behind a gateway route, is a one-line change.
- **Mocks speak the backend envelope.** Mock responses go through the same `unwrap` code as real ones.
- **Legacy CSS lives in a cascade layer.** The cyber theme (`index.css`, `App.css`) sits in a low-priority `legacy` layer. Tailwind's preflight is scoped to `.admin-root`, so the two styles never collide.
- **Admin pages are lazy-loaded.** Drivers never download the dashboard or the chart library.

## Deployment note

This is a single-page app using browser history routes (`/admin/staff`, …). The web server must fall back to `index.html` for unknown paths.
