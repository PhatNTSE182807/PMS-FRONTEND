# AGENTS.md — XXIV Parking frontend (`PMS Frontend`)

Instructions for AI coding agents (Claude Code, Codex, Copilot…) and for people new to the repo.
Read this file first; it is written so you can get oriented in a couple of minutes instead of
re-reading the whole codebase and the SRS.

This repo is one of two. Keep both in mind on every task:

| Repo | Folder | Remote |
| --- | --- | --- |
| Backend | `D:\OJT Project\Parking system` | `git.fsoft-academy.edu.vn/hcm26-cpl-net-07/team-03/parking-management-system` |
| Frontend (this repo) | `D:\OJT Project\PMS Frontend` | `git.fsoft-academy.edu.vn/hcm26-cpl-net-07/team-03/parking-management-system-frontend` |

---

## 1. Non-negotiable rules

1. **Everything written into the repo is in English.** Identifiers, comments, JSDoc, UI text
   (labels, buttons, toasts, validation and error messages), mock data labels, test names,
   commit messages, branch names, PR titles and descriptions, and Markdown docs other than the SRS
   copy. Vietnamese domain words get an English name from the glossary in section 6
   (e.g. "cà vẹt" → `RegistrationCertificate`, never `CaVet`). Talk to the user in Vietnamese
   when they write in Vietnamese; only the chat is Vietnamese.
2. **Work on a feature branch, in both repos, and merge into `develop`.** See section 8.
   Never commit straight to `develop`, `main` or `master`, and in the backend never to `production`
   (it auto-deploys to Azure).
3. **The SRS v1.4 is the source of truth** for behaviour: `document/SRS_v1.4.md`. When the user asks
   for something that contradicts it, do what the user asked and add a line to section 10
   ("Known differences from the SRS").
4. **Never hard-delete business data** (sessions, payments, vehicles, staff accounts): lock,
   detach or anonymise instead (BR-21). Financial records are immutable; corrections are new
   `PaymentAdjustment` rows (NFR-08).
5. **Maker-Checker:** the person who proposes an approval can never approve it (BR-14). Enforce
   it in the backend, never trust role or scope sent by the client (FR-AUTH-07).
6. **Privacy:** public endpoints and public real-time channels never expose licence plates
   (FR-3D-08); vehicle registration photos are only readable with the "verify vehicles"
   permission and every read is audited (FR-VER-06).
7. **No requirement codes in the UI.** Nothing a user can see may show SRS or spec codes such as
   `FR-AUTH-01`, `FR-AD…`, `BR-10`, `NFR-05`, `UC-03` or `SEC-01`: not in labels, buttons,
   tooltips, toasts, dialogs, empty states, page titles, demo/mock data, nor in API error and
   validation messages (the frontend shows those to users). Say the rule in plain words instead
   ("The exit window has passed: 10,000 VND more is due."). Codes are fine in code comments,
   tests, commit messages and docs. Before merging, run
   `grep -rnE "\b(FR|BR|NFR|UC|SEC|Sec)-[A-Z0-9]" src` and remove every hit that is not a comment.
8. **No AI co-author or attribution in git.** Commit messages, merge messages, PR titles and
   descriptions never contain `Co-Authored-By: Claude …`, `noreply@anthropic.com`,
   "Generated with Claude Code" or any other AI-assistant credit. `.claude/settings.json` turns
   Claude Code's attribution off, and `.githooks/commit-msg` strips it as a safety net: run
   `git config core.hooksPath .githooks` once after cloning. Pushed history is not rewritten.

## 2. The system in one screen (SRS v1.4)

Multi-lot parking management: vehicles enter and leave, fees are charged, bays are booked and
shown on a 3D map, cash and online payments are reconciled, managers get reports.

- **Actors / roles:** Admin, Manager, Staff, User (4 roles in ASP.NET Identity) + Guest (no
  account, not a role). Manager and Staff only act inside the lots assigned to them
  (`UserLotAccess`); the "verify vehicles" permission is chain-wide.
- **Who creates whom:** the first Admin is seeded; Admin creates Managers only; a Manager creates
  Staff only in their own lots. Users self-register (form or Google). No OTP / 2FA in v1.4.
- **Apps:** Web Admin/Dashboard (Admin, Manager), POS Staff (gate/counter), customer web/app
  (User, Guest). 3D is rendered only in the frontend; the backend serves the layout JSON and slot
  status over REST + SignalR.
- **Two kinds of bays, physically separate:** *reservation slots* (fixed, signposted, tracked one
  by one with a state machine) and *walk-in capacity* (not assigned a slot; only the **zone
  counter** of a counting zone goes up and down). Walk-in capacity of a zone = active slots −
  reservation slots − maintenance slots. A counting zone is (lot, vehicle type) by default.
- **Bookings are by arrival time**, at most N hours ahead (BR-01, 2 h), with a deposit that is
  deducted from the fee at check-out (BR-03). Arrival window = [arrival − early, arrival + hold]
  (BR-02, 15 min / 15 min).
- **Three payment points:** exit lane (barrier opens at once), counter/kiosk and app. The **exit
  window** (BR-10, 15 min) applies only to the last two (pre-payment).
- **Cash is closed per Staff per day** (no shifts at all — the old `Shift*` entities are legacy).
- **Offline is mandatory:** a lot-level Edge Service keeps gates working; QR tickets and exit
  passes are signed (HMAC) so they can be checked offline (`ParkingTokenSigner`).

Out of scope in v1.4 (do not build unless asked): OTP / 2FA login, monthly passes and
subscriptions, e-invoices, loyalty points / reviews, multi-tenant, shift scheduling,
per-slot sensors for walk-ins, AI forecasting, OCR of registration papers (SRS 2.5).

## 3. Find a requirement fast

`document/SRS_v1.4.md` is the full SRS converted from the team's .docx, with every table kept.
Search by ID instead of reading it top to bottom:

```bash
grep -n "FR-RSV-02" document/SRS_v1.4.md        # one requirement
grep -n "^| BR-" document/SRS_v1.4.md           # all 28 business rules with defaults
grep -n "^| UC-" document/SRS_v1.4.md           # the 15 use cases
grep -n "^#### 4.2" document/SRS_v1.4.md        # exception flows per area
```

| SRS module | IDs | Backend (this repo) | Frontend |
| --- | --- | --- | --- |
| Accounts & RBAC | FR-AUTH-01…12 | `UsersController`, `AdminController` (Managers), `ManagerController` (Staff), `IEmployeeAccountService`, `IGoogleTokenValidator` | `LoginPage`, `RegisterPage`, `pages/admin/StaffAccountsPage`, `pages/management/ManagerStaffPage`, `api/identity.service.ts` |
| Lots, zones, slots | FR-LOT-01…08 | `LotsController`, `ZonesController`, `SlotsController`, `IParkingLotService`, `IZoneService`, `ISlotService`, `Jobs/LotJobs` | `pages/admin/ParkingLotsPage`, `api/lot-management.*` |
| 3D map | FR-3D-01…09 | `LayoutsController` (`api/public/lots/{id}/layout`, rate-limited), `ILayoutService`, `Hubs/LotHub` | `components/customer/garage/*`, `api/layout.service.ts`, `hooks/useLotLayout.ts` |
| Gate operations | FR-OPS-01…19 | `StaffGateController`, `GateRequestsController`, `ParkingSessionsController`, `ManagerOperationsController` (plate lists), `Hubs/ParkingOpsHub`, `Jobs/ParkingJobs` | `pages/staff/StaffGatePage`, `StaffCheckoutPage`, `StaffExceptionsPage` |
| Pricing | FR-PRC-01…06 | `PricingRule*` entities; no pricing controller yet | `pages/management/ManagerPricingPage` |
| Reservations | FR-RSV-01…10 | `ReservationsController`, `IReservationService` | `pages/customer/CustomerBookingsPage`, `pages/management/ManagerReservationsPage` |
| Payments & receipts | FR-PAY-01…11 | `PaymentsController`, `WalletController`, `Services/Payments` (VNPay, MoMo) | `PaymentReturnPage`, `pages/staff/StaffCashTallyPage` |
| Customer app | FR-CUS-01…06 | `UsersController` (profile), `VehicleDocumentsController`, `IParkingHistoryService` | `pages/customer/*` |
| Vehicle verification | FR-VER-01…06 | `VehicleVerificationsController`, `Hubs/VehicleVerificationHub`, `Jobs/VehicleDocumentJobs` | `pages/staff/StaffVehicleVerificationPage` |
| Reports | FR-RPT-01…07 | no report controller yet | `pages/admin/RevenueReportPage`, `AdminDashboardPage` |
| Staff, devices, settings | FR-SYS-01…08 | `NotificationsController`, `SystemSetting`, `Device`, `Gate` entities | `api/system.service.ts`, `api/notification.service.ts` |

## 4. Business rules you will hit most

Defaults are configurable; the full table is SRS section 5.

| Rule | Default |
| --- | --- |
| BR-01 book at most N hours ahead; only vehicle types with "bookable" on | 2 h; cars only |
| BR-02 arrival window | 15 min early, 15 min hold |
| BR-04 / BR-05 cancel ≥ H min before arrival → 100 % refund; later or no-show → deposit kept | H = 30 min |
| BR-06 deposit, payment deadline | 30,000 VND per car; 10 min |
| BR-07 active bookings | 2 per account, 1 per vehicle |
| BR-09 fee 0 → no payment row, record the 0 reason | — |
| BR-10 after the exit window: re-price from entry, subtract paid, add late-exit fee | 15 min |
| BR-11 wait for a dynamic-QR callback | 60 s |
| BR-12 daily cash close: difference that needs a reason; latest close time | 20,000 VND; 23:00 |
| BR-14 approval deadlines, escalate to Admin | lost ticket 10 min; refund / waiver 24 h |
| BR-18 ANPR confidence threshold | 85 % |
| BR-20 overdue / abandoned vehicle | 24 h / 7 days |
| BR-22 price version = the one valid at entry; daily cap per calendar day; round up to 1,000 VND; free period only if total stay ≤ it | — |
| BR-25 / BR-26 review deadline; keep registration photos / gate photos | 24 h; 30 / 90 days |
| BR-28 account form (5 fields), Vietnamese phone `0` + 9 digits, unique email and phone | password: 6+ characters, 1 upper-case letter, 1 special character (team rule, section 10) |

The six fee examples at the end of SRS section 5 are the acceptance tests for pricing; keep a
unit test for each.

## 5. State machines (do not add transitions)

String constants live in `src/PMS.Application/Models/Operations/ParkingStatuses.cs`.

- **Reservation slot:** `Available → Reserved` (user picks, locked until the deposit deadline) →
  `Occupied` (check-in) → `Available` (exit or abnormal close). `Reserved → Available` on deposit
  timeout / cancel / no-show / lot cancel. `Available ⇄ Maintenance` by a Manager, only with no
  active booking. Walk-in bays have no state, only the zone counter.
- **Session:** `PendingEntry` (barrier open, waiting for the loop sensor) → `Active` →
  `PendingPayment` (fee requested at lane, counter or app; back to `Active` on cancel/timeout) →
  `Paid` (paid after deposit, or fee 0; back to `PendingPayment` when a pre-payment exceeds the
  exit window) → `Completed` (vehicle passed the barrier). Side paths: `Active → LostTicketPending
  → PendingPayment` (approved) or back to `Active` (rejected); `Active → AbnormalClosed`
  (Maker-Checker); `Active → EmergencyExit` (Manager then waives or records debt). A turned-back
  car cancels the session (`Cancelled`) and the counter does not change. "Device failure" is not a
  state: it is the *manual* flag with a reason.
- **Reservation:** `PendingDeposit → Confirmed` (deposit in time) or `Expired` (late callbacks are
  refunded automatically). `Confirmed → CheckedIn → Completed`, or `Cancelled` (user),
  `LotCancelled` (100 % refund), `NoShow` (hold time passed). Changing arrival time or slot keeps
  it `Confirmed` and writes `ReservationChangeLog`.
- **Vehicle verification (SRS):** Pending review → Verified / Needs more info (user resubmits,
  max 3, BR-24) / Rejected (appeal → a *different* Manager reviews) / Disputed (plate already
  verified by another owner; Manager decides). Verified → Revoked (Manager, with reason) or
  Removed (user). In code (`VehicleVerificationStatus` in
  `src/PMS.Application/Models/VehicleDocuments/VehicleDocumentModels.cs`) this is `Draft →
  NeedsReview → Approved | Rejected`; `Pending`, `Processing`, `AutoVerified` are legacy OCR states.
- **Daily cash close:** NotClosed → Closed (Staff enters counted cash) → Confirmed (Manager), or
  Closed → HasDifference (over BR-12) → Confirmed after the Manager writes the reason. Cash taken
  after closing becomes an extra close for the same day.

## 6. Glossary (Vietnamese → English name to use in code)

| Vietnamese | English / code name |
| --- | --- |
| bãi xe / khu vực / slot | parking lot / zone / slot |
| zone đếm | counting zone (`ZoneCounter`) |
| slot đặt chỗ | reservation slot |
| xe vãng lai | walk-in vehicle (`WalkIn`) |
| làn / cổng | lane / gate |
| lượt gửi | parking session |
| đặt chỗ, cọc, cấn trừ cọc | reservation, deposit, deposit offset |
| cửa sổ đến / thời gian giữ | arrival window / hold time |
| vé, thẻ, mất vé | ticket, card, lost ticket (`LostTicketCase`) |
| barie | barrier |
| chốt tiền cuối ngày | daily cash close (`DailyCashClose`) |
| kiểm kê tồn bãi | inventory check (`InventoryCheck`) |
| điều chỉnh counter | zone counter adjustment |
| session "ma" | ghost session |
| đóng bất thường / đóng cưỡng bức | abnormal close / forced close |
| ra khẩn cấp, chế độ khẩn cấp | emergency exit, emergency mode |
| duyệt theo điều kiện | conditional approval |
| người đề xuất / người duyệt | maker / checker |
| hoàn tiền, miễn phí, hủy bill | refund, fee waiver, bill void (all `PaymentAdjustment` types) |
| cà vẹt | vehicle registration certificate (`RegistrationCertificate`) |
| CCCD | citizen ID (`CitizenId`) |
| xác minh phương tiện, tranh chấp, thu hồi | vehicle verification, dispute, revocation |
| chủ quản | primary owner |
| sự cố | incident |
| hàng chờ xung đột | conflict queue |
| bảng giá, block, trần/ngày | pricing rule, time block, daily cap |

## 7. Get oriented in two minutes

Run these before planning anything, in **both** repos:

```bash
git status --short && git branch --show-current
git log --oneline -15 develop                  # what landed recently
git branch -a --list "*features/*"             # work in progress per feature / screen
git log develop..HEAD --oneline                 # what this branch adds
```

Then, in this repo:

```bash
grep -n "path:" src/router.tsx                  # every screen and its route
ls src/pages/* src/api                          # screens per role, API services
grep -rln "isMockService" src/api               # services that can run on mock data
npm run lint && npm run build                   # build = type-check + Vite build
node --test tests/parking                       # unit tests for lot rules and services
```

`src/router.tsx` shows the areas: `/` home, `/login`, `/register`, `/me` (User), `/admin`
(Admin), `/management` (Manager), `/staff` (Staff). `document/API_DOCUMENT.md` lists the backend
endpoints the UI uses. A screen whose service only has mock data (`src/mocks`, `useDemo*` hooks,
`VITE_MOCK_SERVICES`) is waiting for its API: check section 3 and the backend repo.

## 8. Git workflow (both repos)

Branch name: `features/<feature-or-screen-name>` in lower-case kebab case, in English, e.g.
`features/daily-cash-close`, `features/staff-gate-screen`, `features/reservation-deposit`.
Use the **same branch name in both repos** when one feature touches the API and the UI, even if
one side has only a small change.

```bash
# 1. start: in each repo that the task touches
git checkout develop && git pull origin develop
git checkout -b features/<name>            # or: git checkout features/<name> if it exists

# 2. work, then commit in English (Conventional Commits)
git add <files> && git commit -m "feat(reservations): deduct the deposit at check-out"

# 3. finish every coding task by merging into develop
dotnet build PMS.sln && dotnet test tests/PMS.Application.UnitTests   # frontend: npm run lint && npm run build
git checkout develop && git pull origin develop
git merge --no-ff features/<name>
git push origin develop
git checkout features/<name>               # keep working on the branch afterwards
```

- Check the branch before the first edit of a task; if you are on `develop`, create or switch to
  the feature branch first. Carry uncommitted work along (`git checkout -b` keeps it).
- Commit types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `style`; the scope is
  the module (`auth`, `lots`, `gate`, `reservations`, `payments`, `verification`, `layout`…).
- Merge only after build and tests pass. On a merge conflict, resolve it on the feature branch
  (`git merge develop` there), test again, then merge.
- Do not rewrite shared history (`push --force`, rebase of pushed branches) and do not touch
  `main`, `master` or `production`; releases to `production` are done by the team.
- The API and the UI must agree: when an endpoint or DTO changes, update the frontend types
  (`src/types/*.dto.ts`) and service on the same-named branch, and merge both repos.


## 9. This repo

- React 19 + TypeScript, Vite, npm, Tailwind CSS v4, React Router, TanStack React Query, Axios,
  SignalR client, three.js for the 3D map, zod + react-hook-form, lucide-react icons. New code is
  `.ts`/`.tsx`; legacy `.jsx` screens are migrated when touched (`allowJs`).
- Layering: pages / components → hooks (React Query) → `src/api/*.service.ts` →
  `src/api/axiosClient.ts`. Components never call HTTP directly. Query keys live in
  `src/api/queryKeys.ts`; real-time subscriptions in `src/api/realtime.ts`,
  `parkingOpsRealtime.ts`, `vehicleVerificationRealtime.ts`.
- DTOs live in `src/types/*.dto.ts` and mirror the backend contracts exactly; change them on the
  same feature branch as the backend change.
- Every service supports mock mode through `isMockService()` in `src/config/env.ts`
  (`VITE_USE_MOCK_DATA=true` mocks everything; `VITE_MOCK_SERVICES` picks services, default
  `capacity,reports`). Mock data lives in `src/mocks`. Show mock data as demo data in the UI.
- 3D: `src/components/customer/garage/*` (three.js, instanced meshes, on-demand rendering). Keep
  it light: SRS NFR-3D-01 asks for ≥ 30 FPS with 500 slots on a mid-range device.
- Styling: the admin, manager and staff consoles use Tailwind scoped to `.admin-root`; the
  customer area uses `src/styles/customer.css`; the legacy theme sits in the `legacy` cascade layer.
- Validate with `npm run lint` and `npm run build`; check visible changes in the browser
  (`npm run dev`, or the `frontend` launch configuration on port 5174) before merging.
- Never commit `.env`; add new variables to `.env.example`.

## 10. Known differences from the SRS

Keep this list current; it is the first place to look when code and SRS disagree.

- Password rule (confirmed by the team on 2026-10-24, keep it): at least 6 characters with at
  least one upper-case letter and at least one special character, for every account. It replaces
  BR-28's rule (8+ characters with upper, lower and digit); do not switch to the SRS version.
  The single source is `src/lib/password.ts` (`PASSWORD_RULES`, `isValidPassword`); the backend
  uses the same rule in `UserValidatorConfiguration`.
- Some screens run on demo data until their API exists (as of 2026-10-24): manager approvals and
  pricing, staff exceptions / incidents and cash tally, revenue reports. Re-check with the
  commands in section 7 before relying on this line.
- The 3D lot model is built from three building templates chosen by the Admin
  (`garageModel.ts`), not yet from a published `Layout3D` with draft/publish versions (FR-3D-05).
- Bookings have two modes: pay-as-you-go follows the SRS (arrival time only); scheduled also
  takes a departure time, which the SRS does not have.
- `src/components/OtpLoginScreen.jsx` and other OTP code are out of scope in v1.4 (no OTP / 2FA).
- The user wallet (`api/wallet.service.ts`, `hooks/useWallet.ts`) is a team addition: the SRS
  lists an internal wallet as out of scope (2.5), but it is in active use for payments.
