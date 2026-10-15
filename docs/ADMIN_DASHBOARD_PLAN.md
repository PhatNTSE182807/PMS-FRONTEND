# PBMS Frontend vs. Admin Dashboard Spec — Gap Analysis & Migration Plan

## Context
The spec (`c_t_k_thu_t_frontend_admin_dashboard.md`) describes an **Admin Dashboard** (Staff/Manager management, Revenue report, Parking capacity) built on a layered frontend with mock-able services and per-microservice API clients behind a gateway. This plan compares that spec with:
- **Frontend**: `parking-management-system-frontend/parking-management-system-frontend` (React 19 + Vite 7, plain JS)
- **Backend**: `../parking-management-system` (.NET 9, PMS.API / Application / DataAccess / Core / Shared)

The goal is to work out what has to change so the admin dashboard can be built now against mocks, run on today's monolith, and later move to microservices without rewriting the UI.

> **Status (branch `feature/admin-dashboard`):**
> - **Phase A (frontend foundation) — done.**
> - **Phase B (admin dashboard on mocks) — done.**
>
> Deferred:
> - Decomposing the 1,500-line `UserScreen.jsx` into components. Its data access already moved to hooks.
> - Phase C (backend endpoints in the `parking-management-system` repo).
> - Phase D (microservice readiness).
>
> Section 1 below describes the codebase *before* this branch.

---

## 1. What exists today

### Frontend (≈2.4k LOC, 5 components + 1 service)
| Area | Current state |
|---|---|
| Language | JavaScript/JSX (spec requires **TypeScript**) |
| Deps | only `react`, `react-dom`. No router, React Query, axios, Tailwind/shadcn, recharts, RHF/zod, lucide |
| Routing | `useState('login'\|'register'\|'user')` in `src/App.jsx`. No URL routes and no role guards |
| API layer | One god-object `src/services/authService.js` (~580 lines) handles auth, profile, vehicles, password, health-check, and base URL |
| HTTP | Raw `fetch` with the headers and `Bearer` token copy-pasted into every method. No interceptors, no 401 handling, no refresh |
| Envelope parsing | Defensive guessing: `result?.result \|\| result?.data \|\| result` and `token \|\| accessToken`. A login fallback calls `/users/login` on 404 |
| Mocks | Ad hoc: hardcoded demo users in `App.jsx` / `LoginScreen.jsx`, seeded `useState([...])` arrays in `UserScreen.jsx` (1530 lines), and a "fallback local update for demo" when an API call fails. **No `USE_MOCK_DATA` switch** |
| State | Local `useState` only. Session stored in `localStorage`/`sessionStorage` (`pms_token`, `pms_user`) |
| Config | `VITE_API_BASE_URL`, which can be overridden at runtime by `localStorage.pms_custom_api_url` through `ApiStatusBadge` |
| Screens | Login, Register, and the end-user (driver) dashboard. **No admin screens at all** |

### Backend (one deployable, the "Clean Architecture" monolith)
- Endpoints: only `UsersController` (`/api/Users/...`): register, authenticate, profile CRUD, vehicles CRUD, vehicle-types, change-password, `GET /{id}/profile` (Admin).
- Envelope: `ApiResult<T> { succeeded, result, errors: string[] }`, used for success, validation (`ValidateModelAttribute` → 400), and exceptions (`ExceptionHandlingMiddleware` → 404/400/422/500).
- Auth: symmetric JWT, 7-day expiry. Claims: NameIdentifier, Name, Email, MobilePhone, Role. A `RefreshToken` entity exists but isn't used.
- Roles: a single string `ApplicationUser.Role` (`"Admin"`, `"User"`). No `Manager` or `Staff` yet.
- The domain model is already rich (scaffolded entities): `Employee`, `EmployeeAssignment`, `UserLotAccess`, `ParkingLot`, `Zone`, `ZoneOccupancy`, `ZoneVehicleCapacity`, `ParkingSession`, `Payment`, `Invoice`, `Subscription`, `Shift`, etc. **The data for all 3 spec modules is modelled. No use cases or controllers expose it.**
- Layering issues to keep in mind:
  - `PMS.Application` references `PMS.DataAccess`, so Application depends on Infrastructure. That's N-layer, not true Clean Architecture.
  - Entities in `PMS.Core` use the namespace `PMS.DataAccess.Persistence.Entities`.
  - `GET /api/Users` is `[AllowAnonymous]` and lists all users. The frontend uses it as a health check (`authService.checkConnection`).
  - CORS is `AllowAnyOrigin`.

---

## 2. Spec vs. reality — key mismatches

| # | Spec says | Reality | Impact / decision |
|---|---|---|---|
| 1 | `ApiResponse<T> { isSuccess, data, message?, errors?: {code, description}[] }` | `ApiResult<T> { succeeded, result, errors: string[] }` | **Biggest contract conflict.** Pick one shape. Recommendation: keep the backend shape for now and **normalize it in one place on the frontend** (`axiosClient` → domain `Result<T>`). Later, evolve the backend to `errors: {code, description}[]` with an `ApiResult` v2. |
| 2 | URLs `/api/v1/identity/...`, `/api/v1/reports/...`, `/api/v1/parking/...` through a gateway | `/api/Users/...`, no versioning, no gateway | Make the **service prefix configurable per client** (`VITE_IDENTITY_BASE`, `VITE_PARKING_BASE`, `VITE_REPORT_BASE`). Today they all point to the monolith. After the split they point to gateway routes. |
| 3 | Roles `MANAGER \| STAFF`, statuses `ACTIVE/INACTIVE/SUSPENDED` | Roles `Admin`/`User` (PascalCase strings). `Employee.Status` is a free string | Agree on an enum casing (recommend UPPER_SNAKE in JSON, via the `JsonStringEnumConverter` policy). Backend needs Manager/Staff roles and admin-only user creation. |
| 4 | IDs are `string` | `ParkingLot.Id`, `Zone.Id`, `Employee.Id` are `int`. `User.Id` is a string GUID. `Payment.Id` is `long` | Treat all IDs as `string` in frontend DTOs, and have the backend serialize them as strings (or convert in the mapper). This is also microservice-safe. |
| 5 | `UserDTO` = account + employeeCode + assigned lots | Spread across `AspNetUsers` + `Employee` + `EmployeeAssignment`/`UserLotAccess` | Backend needs a composed read model (`EmployeeAccountDto`). In microservices, Identity owns the account, and staff/assignment probably belongs to an **Operations/Staff** service, not Identity. |
| 6 | Payment methods `CASH \| QR_BANKING \| RFID_WALLET` | `Payment.PaymentMethod` free string | Lock this down as a backend enum or lookup before building charts. |
| 7 | Vehicle types `CAR/MOTORBIKE/BICYCLE/EV_CHARGING` | `VehicleType` table (id, code) | Frontend should use `VehicleType.code` from the API, not hardcoded unions, or accept a `string` with known constants. |
| 8 | `PaginatedResponse<T>` | No pagination anywhere (`GetAllAsync` returns everything) | Add a `PagedResult<T>` to the backend Application layer, with matching names: `items, pageNumber, pageSize, totalCount, totalPages`. |
| 9 | Real-time capacity | No SignalR/SSE. `ZoneOccupancy` has `RowVersion` | Phase 1: React Query `refetchInterval` (5–10s). Phase 2: SignalR hub (`/hubs/occupancy`) feeding `queryClient.setQueryData`. |
| 10 | Reports service | No aggregation queries | Report endpoints are read-only aggregations over `ParkingSession`/`Payment`/`Subscription`. In microservices this becomes a read-model/CQRS service fed by events. |

---

## 3. How the frontend should work with the backend (target design)

```
pages/  ──►  hooks/ (React Query)  ──►  api/*.service.ts  ──►  axiosClient  ──►  Gateway / Monolith
                                            │
                                            └── USE_MOCK_DATA ? mocks/*.mock.ts (500ms delay)
types/*.dto.ts  ◄── shared by all layers (mirror backend Application DTOs)
```

Key rules:
1. **One HTTP client** (`src/api/axiosClient.ts`):
   - Attaches the Bearer token.
   - Unwraps `ApiResult` (`succeeded/result/errors`) into `T`, or throws a typed `ApiError { status, errors[] }`.
   - On 401 it clears the session and redirects to login. This later becomes a refresh-token flow.
   - The only place that knows the backend envelope. When the backend moves to `{isSuccess,data,errors[{code,description}]}`, only this file changes.
2. **One client per bounded context**, each with its own base path. This is what makes the monolith → microservices move a config change:
   - `identity.service.ts` → today `/api/Users`, later `/api/v1/identity`
   - `parking.service.ts`, `report.service.ts` (and later `staff.service.ts`)
3. **Mock switch** in each service:
   - `import.meta.env.VITE_USE_MOCK === 'true'` → return `mocks/*` wrapped in the same result type, with a delay.
   - This replaces all the scattered demo fallbacks in `LoginScreen`/`UserScreen`/`App`.
4. **Auth/role guard**:
   - React Router routes `/login`, `/me/*` (driver), `/admin/*` (Admin), `/manager/*` (Manager/Staff later).
   - Role comes from the JWT `role` claim (decode on login) or from `LoginResponseModel.role`.

---

## 4. Recommended implementation sequence

### Phase A — Frontend foundation (no backend change needed)
1. Add TypeScript (`tsconfig.json`, rename `main.jsx` → `main.tsx` first; `allowJs: true` so existing JSX keeps working during migration).
2. Install: `react-router-dom`, `@tanstack/react-query`, `axios`, `zod`, `react-hook-form`, `@hookform/resolvers`, `recharts`, `lucide-react`, `tailwindcss` + shadcn/ui.
   - Existing `App.css`/`index.css` cyber theme stays for the auth/driver screens. The admin area uses Tailwind.
3. Create `src/api/axiosClient.ts`, `src/types/common.dto.ts` (`ApiResult<T>` as the backend actually sends it, plus a normalized `PagedResult<T>`), and `src/config/env.ts` (base URLs + `USE_MOCK`).
   - Keep the `ApiStatusBadge` runtime URL override for dev only.
4. Split `authService.js` into `api/identity.service.ts` (auth + register) and `api/profile.service.ts` (profile/vehicles/password). Behaviour stays the same; the copy-pasted fetch boilerplate is removed.
   - Remove the `/users/login` 404 fallback and the `result.data || result` guessing.
5. Add hooks (`useLogin`, `useProfile`, `useVehicles`, …) and migrate `LoginScreen`, `RegisterScreen`, `UserScreen` to them.
   - Break `UserScreen.jsx` (1530 lines) into `features/profile/*` components.

### Phase B — Admin dashboard on mocks (spec modules 1–3)
6. `types/identity.dto.ts`, `parking.dto.ts`, `report.dto.ts`, following the spec, with these adjustments:
   - IDs are `string`.
   - Vehicle type is `string` code.
   - Errors are adapted to `string[]` until the backend changes.
7. `mocks/users.mock.ts`, `revenue.mock.ts`, `capacity.mock.ts`, with Vietnamese names and VND formatted by `Intl.NumberFormat('vi-VN')`.
8. `components/layout/AdminLayout` (sidebar + header) and routes `/admin/staff`, `/admin/revenue`, `/admin/capacity`, guarded by role `Admin`.
9. Build the pages per the spec:
   - `UserManagementPage`: table, filters, create drawer with RHF + zod.
   - `RevenueReportPage`: KPI cards, area chart, donut chart, bar chart, breakdown table.
   - `ParkingCapacityPage`: gauges, the color thresholds <70 / 70–90 / >90, the simulation toggle, and the zones modal.

### Phase C — Backend endpoints in the monolith (structured as future service boundaries)
Organize the backend by feature folders, so each one can be lifted into its own service:
- `Identity`: `POST /api/v1/identity/staff` (Admin creates a Manager/Staff account), `GET /api/v1/identity/staff?page&role&lotId&status&search`, `PATCH .../{id}/status`, `POST .../{id}/reset-password`. Seed the Manager/Staff roles.
- `Parking`: `GET /api/v1/parking/lots/capacity`, `GET /api/v1/parking/lots/{id}/zones`. These aggregate `ZoneOccupancy` grouped by `VehicleType`.
- `Reports`: `GET /api/v1/reports/revenue/kpi|timeseries|payment-methods|by-lot|breakdown?startDate&endDate&parkingLotId&vehicleType`.
- Cross-cutting:
  - Add `PagedResult<T>`.
  - Add API versioning, or simply prefix new routes with `/api/v1`.
  - Make `GET /api/Users` Admin-only, and add `/health` so the frontend stops probing `/users`.
  - Restrict the CORS origins.
  - Optional: fix the Application → DataAccess dependency by inverting it with repository interfaces in Application/Core.

Switching the frontend from mock to real is then just `VITE_USE_MOCK=false` per service.

### Phase D — Microservice readiness
- **Gateway**: YARP (fits .NET) or Ocelot, routing `/api/v1/identity/*`, `/api/v1/parking/*`, `/api/v1/reports/*`. The frontend only knows the gateway URL. Per-service env vars collapse into one `VITE_API_GATEWAY_URL` plus fixed prefixes.
- **Auth**:
  - Move to asymmetric JWT (RS256 + JWKS), so each service validates tokens without the shared secret.
  - Add refresh tokens (the entity already exists). The axios interceptor gets single-flight refresh.
- **Data ownership**: Identity (users/roles), Parking (lots/zones/occupancy/sessions), Billing (invoices/payments/subscriptions), Reports (read model fed by events such as `VehicleCheckedIn`, `PaymentCompleted`).
- Cross-service views like `UserDTO.assignedParkingLots[{id,name}]` either get composed at a BFF/gateway or denormalize the lot name into Identity/Staff through events. The frontend DTO stays the same either way.
- **Errors**: standardize on `{ code, description }` (or RFC 7807 ProblemDetails) across all services. Only `axiosClient` adapts.
- **Real-time**: the Parking service publishes occupancy changes through a SignalR hub behind the gateway (WebSocket passthrough).
- **Correlation**: the frontend sends an `X-Correlation-Id` header from the interceptor for distributed tracing.

---

## 5. Critical files
- Replace/split: `src/services/authService.js`, `src/App.jsx` (router), `src/components/UserScreen.jsx` (decompose), `src/components/LoginScreen.jsx` (remove inline demo storage writes), `src/components/ApiStatusBadge.jsx` (use `/health`, dev-only)
- New: `src/api/*`, `src/types/*`, `src/mocks/*`, `src/hooks/*`, `src/components/layout/*`, `src/pages/admin/*`, `tsconfig.json`, `.env.example`
- Backend reference (contract source of truth): `PMS.Application/Models/ApiResult.cs`, `PMS.Application/Models/User/*`, `PMS.API/Controllers/UsersController.cs`, entities `Employee`, `EmployeeAssignment`, `UserLotAccess`, `ParkingLot`, `Zone`, `ZoneOccupancy`, `Payment`, `ParkingSession`

## 6. Git workflow (GitLab: `origin` = git.fsoft-academy.edu.vn/hcm26-cpl-net-07/team-03/parking-management-system-frontend)
Current state: on `develop`, working tree clean.

First deliverable after approval: save this plan into the repo as `docs/ADMIN_DASHBOARD_PLAN.md` on the new branch, commit it, and push.

```bash
git checkout develop
git pull origin develop
git checkout -b feature/admin-dashboard
# (plan copied to docs/ADMIN_DASHBOARD_PLAN.md)
git add docs/ADMIN_DASHBOARD_PLAN.md
git commit -m "docs: add admin dashboard gap analysis and migration plan"
git push -u origin feature/admin-dashboard
```
Then open a Merge Request `feature/admin-dashboard` → `develop` on GitLab. The push output prints a direct link to create it.

Later phases go on the same branch, or on sub-branches cut from it (`feature/admin-dashboard-foundation`, `-mocks`, …) that merge back to `develop` phase by phase.

## 7. Verification
- `npm run lint` and `npm run build` (with `tsc --noEmit`) are clean after each phase.
- With `VITE_USE_MOCK=true`: all 3 admin pages render, filters work, account creation adds a row and shows a toast, and the capacity simulation flips colors at 70/90/100%.
- With `VITE_USE_MOCK=false` against the running `PMS.API` (`https://localhost:44391`):
  - Login as the seeded Admin, then load profile and vehicles. There should be no regression from the current screens.
  - Expired or invalid token → redirect to login.
- Phase C: the backend integration tests (`tests/PMS.Api.IntegrationTests`) are extended for the new endpoints, and the frontend points at them with mocks off.
