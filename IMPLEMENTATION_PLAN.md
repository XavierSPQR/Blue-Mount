# Blue Hills Tea Factory — Implementation Plan

Decisions locked in from clarification round:

| Area | Decision |
|---|---|
| Hosting | Next.js **static export** (`output: 'export'`) on **Firebase Hosting**, Spark (free) plan — no Cloud Functions/Cloud Run |
| Roles | 3 login roles: **Supplier**, **Collector**, **Company Admin** |
| PDF pay slips | Generated **client-side** (no server) |
| Scale | Small — single company, tens of suppliers/collectors |
| Account creation | Admin creates Supplier/Collector logins via a **secondary Firebase Auth app instance** (client-side, no Admin SDK) |
| Requests/Advances | Full **approval workflow** (Pending → Approved/Rejected → Fulfilled) |
| Language | English only (v1) |
| Units | Quantities in **kg**, money in **LKR** |
| Pay computation | `Σ(quantityKg × rate for that entry's grade, as of that entry's date)` per period, minus selected outstanding deductions. Rate is **per tea grade**, marked by the collector at collection time (not a single flat rate) |
| Grades | Admin-manageable list (add/rename/retire); one grade per collection entry |

Open item still needing an answer before Phase 6 (Pay Slips): **how is pay computed** — a single global rate/kg, a per-supplier rate, or a rate entered per collection entry? Plan assumes a single admin-editable "rate per kg" with history (so past pay slips stay correct if the rate changes), until confirmed otherwise.

---

## 1. Why static export (and what it costs us)

Firebase Hosting's Next.js *SSR* integration runs your server code as a Cloud Function/Cloud Run — which requires the **Blaze** plan (billing account attached), even though usage may stay within Blaze's own free monthly quota. Since we're constrained to Spark, the app is built as a static export: every page is pre-rendered HTML/JS, and **all data access happens client-side** via the Firebase Web SDK talking directly to Firestore/Auth.

Consequences to design around:
- No API routes, no middleware, no server actions.
- No Admin SDK — anything "admin creates a user" or "server validates X" must be done with tricks (secondary app instance) or pushed into **Firestore Security Rules**, which become the *real* backend authorization layer. This is the most important thing to get right (Phase 8 is not optional polish).
- Route protection (redirect unauthenticated/wrong-role users) happens client-side after Firebase Auth resolves, not via middleware — expect a brief "checking session" flash on load; design a loading skeleton for it.

## 2. Tech stack

- **Next.js 16** (App Router), `output: 'export'`, TypeScript, Tailwind (already scaffolded in the repo)
- **Firebase**: Auth (Email/Password), Firestore, Hosting. **No Storage** — see below.
- **react-hook-form + zod** — forms and validation
- **@tanstack/react-query** (or plain `onSnapshot` hooks) — data fetching/caching against Firestore
- **recharts** — 6-month graphs / dashboards
- **@react-pdf/renderer** — client-side pay-slip PDF generation
- Company logo: bundle the existing `compane logo.jpeg` as a static asset in `/public` — avoids needing Firebase Storage entirely, keeping the whole project inside Auth + Firestore + Hosting (simpler rules surface, nothing to secure in Storage).

## 3. Data model (Firestore)

```
users/{uid}                — role: 'supplier'|'collector'|'admin', linkedId, displayName, active
suppliers/{supplierId}     — name, contact, address, joinDate, active, authUid
collectors/{collectorId}   — name, contact, joinDate, active, authUid
collections/{id}           — supplierId, collectorId, date, quantityKg, createdAt, createdBy
                              (one doc per collection entry — the core transactional record)
rateHistory/{id}           — ratePerKg, effectiveFrom, setBy         (admin-editable, append-only)
requests/{id}               — supplierId, type: 'fertilizer'|'teaPowder', description, qty,
                              status: pending|approved|rejected|fulfilled, requestedAt, decidedAt, decidedBy
advances/{id}               — supplierId, amount, date, status, notes, decidedBy
deductions/{id}             — supplierId, type: 'fertilizer'|'teaPowder'|'advance',
                              amount, sourceId (links to requests/advances doc), appliedToPayslipId|null
payslips/{id}               — supplierId, periodStart, periodEnd, grossKg, grossAmount,
                              deductionIds[], netAmount, generatedAt, generatedBy
```

At "small" scale, dashboards (today/week/month) query `collections` directly with a date-range + `where(supplierId==)/where(collectorId==)` filter and sum client-side — no pre-aggregation needed. **Flagged for later**: if supplier/collector count grows into the hundreds, move to daily/monthly rollup documents (written transactionally alongside each collection entry) to keep Firestore reads well under the 50K/day free quota — noted here so it's a deliberate, revisitable choice, not a surprise.

## 4. Security model (the real backend)

Firestore Security Rules enforce, per role (role looked up via `get(/databases/$(db)/documents/users/$(request.auth.uid)).data.role`):

- **supplier**: read own `suppliers` doc, own `collections`, own `payslips`, own `requests`/`advances`/`deductions`; **create** `requests`/`advances` only as `status: 'pending'`, never write `status` themselves; no write access to `collections` or `payslips`.
- **collector**: read the supplier roster (name/id/status only — no financials); create `collections` docs (with `createdBy == request.auth.uid`); read own collection history; no access to requests/advances/payslips.
- **admin**: full read/write everywhere; only admin may transition `requests.status`/`advances.status`, write `rateHistory`, and write `payslips`.
- Deny-by-default on everything not explicitly listed.

This ruleset gets **unit-tested** with `@firebase/rules-unit-testing` in Phase 8 rather than trusted by inspection — with no server layer, rules bugs are the whole attack surface.

## 5. Auth & account provisioning

- `AuthProvider` (React context): subscribes to `onAuthStateChanged`, then loads the `users/{uid}` doc for role + active flag; blocks access and signs out if `active === false`.
- Route groups per role (`(admin)`, `(collector)`, `(supplier)`) with a client-side guard component redirecting on role mismatch.
- **Admin-creates-account flow**: initialize a second, throwaway `FirebaseApp` instance in the browser (`initializeApp(config, 'secondary')`), call `createUserWithEmailAndPassword` on *that* instance (so it doesn't touch the admin's own session), write the resulting `uid` into `users/{uid}` + `suppliers/{id}` or `collectors/{id}`, then `signOut` and delete the secondary app instance. Admin sets a temp password; user is prompted to change it on first login.
- First admin account: created manually once via Firebase Console (Authentication tab) + a manually-seeded `users/{uid}` doc — documented as a one-time setup step, not built as a UI flow.

## 6. Information architecture

```
/login
/(admin)/dashboard
/(admin)/suppliers            — list, register, edit, ID assign, active/inactive, history/detail
/(admin)/collectors           — list, register, ID assign
/(admin)/tea-leaf             — company-wide totals: today/week/month/6-month, supplier-wise, collector-wise
/(admin)/requests             — approve/reject fertilizer & tea-powder requests
/(admin)/advances             — approve/reject advances
/(admin)/payslips             — generate pay slip for supplier+period, view/download PDF
/(admin)/settings/rate        — set current rate/kg (writes rateHistory)

/(collector)/dashboard        — today/week/month/6-month collection totals (own)
/(collector)/collections/add  — record a new collection entry
/(collector)/collections      — own history, daily/monthly view
/(collector)/suppliers        — read-only supplier roster

/(supplier)/dashboard         — today/week/month/6-month leaf quantity (own)
/(supplier)/payslips          — list + download PDF
/(supplier)/requests          — submit/view fertilizer & tea-powder requests
/(supplier)/advances          — view advance details + request new
```

## 7. Build phases

| Phase | Scope |
|---|---|
| 0 | Create Firebase project "Blue Mount"; enable Auth (email/password), Firestore, Hosting; `next.config` static export; Firebase SDK init/env; deploy an empty skeleton to prove the Hosting pipeline end-to-end |
| 1 | AuthProvider, login page, role-based route guards, secondary-app admin account creation, manual first-admin setup doc |
| 2 | Supplier & Collector master-data CRUD (register, ID assign, edit, active/inactive, history view) |
| 3 | Collections: collector "add collection" form, own history, daily/monthly filters |
| 4 | Dashboards: today/week/month/6-month for supplier, collector, and company-wide (+ supplier-wise, collector-wise breakdowns); recharts graphs |
| 5 | Requests & Advances: supplier submission forms, admin approval workflow, deductions ledger |
| 6 | Pay slips: gross-from-collections × rate, minus linked deductions, list per supplier/period, client-side PDF generation & download |
| 7 | Polish: inactive-user login block, zod validation everywhere, mobile-first layout (collectors are field users on phones), loading/empty/error states |
| 8 | Security rules written + unit-tested (`@firebase/rules-unit-testing`) — the primary hardening pass |
| 9 | Firebase Hosting deploy, seed initial admin + rate, short admin user-guide |

## Progress log

- **Phase 0 — done.** Firebase project `blue-mount-5e5a6`, Firestore (asia-south1), Web app registered, Hosting deployed at https://blue-mount-5e5a6.web.app, Auth Email/Password enabled.
- **Phase 1 — done.** `AuthProvider` + `RoleGuard`, login page, root role-based redirect, admin account creation via secondary Firebase App instance (`src/lib/createLinkedUser.ts`), Firestore rules extended to cover the `users` collection (still closed everywhere else). One IA deviation: section 6's `/(admin)/...` notation used Next.js route-group syntax, which strips the parentheses from the URL — that would have collided all three roles' dashboards onto the same `/dashboard` path. Implemented as real segments (`/admin/...`, `/collector/...`, `/supplier/...`) instead; same layout-per-role structure, just distinct URLs.
- **First admin bootstrap** (one-time, manual — see instructions given when Phase 1 shipped): create the account in Firebase Console → Authentication, then its `users/{uid}` doc in Firestore Console (role: `admin`), since no admin exists yet to use the in-app creation flow.
- **Phase 2 — done.** Supplier & Collector management under `/admin/suppliers` and `/admin/collectors`: register (auto-assigned `SUP-000N`/`COL-000N` IDs via a `counters` transaction), edit details, active/inactive toggle, and per-record login setup (replaces Phase 1's standalone `/admin/users` page — deleted). Suppliers/Collectors are near-identical in shape, so it's built as one generic `roster` module (`src/lib/roster.ts`, `src/hooks/useRoster.ts`, `src/components/roster/*`) parameterized per role, rather than duplicated. Firestore rules extended: `suppliers`/`collectors` (admin full access; collector reads the supplier roster; a supplier/collector can read their own linked record) and `counters` (admin-only). "History" is a placeholder note on the detail page — real collection-based history arrives with Phase 3/4.
- **Phase 5 — done.** `requests`, `advances`, `deductions` collections. Supplier: `/supplier/requests` (submit fertilizer/tea-powder request + own history), `/supplier/advances` (request an advance + own history), `/supplier/deductions` (read-only, outstanding total). Admin: `/admin/requests` (approve/reject pending; **mark fulfilled** on an approved request — prompts for the LKR cost, which creates the linked deduction), `/admin/advances` (approve/reject — **approving IS the disbursement**, so the deduction is created in the same transaction as the approval, unlike requests which need a separate later fulfillment step for the physical hand-over), `/admin/deductions` (ledger, filterable by supplier). `fulfillRequest`/`approveAdvance` write the deduction + status change as a single Firestore transaction so they can never land only one of the two. Rules: a supplier can only create their own `pending` requests/advances (never self-approve, never file under another supplier); all status transitions and all deduction writes are admin-only; deductions are visible to admin and the owning supplier. Added composite indexes for `requests`/`advances`/`deductions` (each `supplierId + <timestamp> desc`).
- **Phase 9 — done. Plan complete (Phases 0–9).** Added a self-service **forgot-password** flow on `/login` (found missing while writing the guide below — without it, "forgot your password" had no answer but "ask an admin to re-provision you," which is a bad experience Firebase Auth solves for free); uses `sendPasswordResetEmail`, shows the same neutral confirmation regardless of whether the email is registered (no account enumeration). `ADMIN_GUIDE.md` added to the repo as the operational reference (setup order, day-to-day per role, the approval/fulfillment vs. approval-is-disbursement distinction, generating pay slips, known limitations). Also published as a designed, readable artifact for actual non-technical admin staff — the repo markdown is the source of truth, the artifact is the hand-off copy. Final deploy: rules, indexes, and hosting all redeployed together; 50/50 rules tests green; clean build/lint.
- **Phase 8 — done.** Rules unit tests via `@firebase/rules-unit-testing` + the Firestore emulator (`tests/rules/firestore.rules.test.ts`, `npm run test:rules`) — 50 tests covering every collection's read/write/role matrix, not just trusting the rules by inspection. **Found and fixed a real gap while writing them**: `firestore.rules` never actually checked the `active` flag anywhere — deactivating a user only made the *app* sign them out (`AuthContext`); their Firebase Auth session/ID token stayed valid, since we only flip a Firestore field rather than disabling the Auth account itself, so a deactivated user hitting Firestore directly (bypassing the UI) would have kept every permission their role otherwise granted. Fixed by routing `isAdmin()`/`isCollector()`/`isSupplier()` through a shared `isActive()` check; reading your *own* profile deliberately stays exempt (that's how the app detects deactivation to sign itself out) — the fix has a dedicated regression test (`INACTIVE_SUPPLIER` fixture) proving a deactivated supplier loses read access to their own supplier record. Also tightened the two `suppliers`/`collectors` "read own record" branches from a bare `isSignedIn()` check to the correct role check, closing a smaller latent hole. This environment only had JDK 17 (the emulator needs 21+); used a portable Temurin JDK 21 rather than a system package requiring sudo — documented in `README.md`.
- **Phase 7 — done.** Mobile-first nav: `DashboardShell` now collapses its nav (9 links for admin) behind a hamburger toggle below the `sm` breakpoint instead of wrapping/overflowing, with active-link highlighting and an auto-close-on-navigate (done via the React-recommended "adjust state during render" pattern, not an effect, to dodge the same set-state-in-effect lint rule hit earlier in `AuthContext`). Inactive-account handling tightened: previously an inactive user's `RoleGuard` check only looked at `role`, so there was a brief window before `AuthContext`'s async `signOut()` landed where protected content could flash; both `RoleGuard` and the root page now redirect on `active === false` immediately, and `/login` shows a distinct "account deactivated" message (`?error=inactive`) instead of the generic no-profile one. Grades' "add" form converted from raw `useState` to `react-hook-form` + `zod`, matching every other form in the app. `/admin/payslips` gained an explicit loading state for its supplier summary (entries/deductions/payslips) so it can no longer flash "no collections" before data arrives.
- **Phase 6 — done.** Retrofitted `collections` with a required `gradeId` (grade picker added to Add Collection, shown in collector History). New: `grades` (admin-manageable: add/rename/retire, `/admin/grades`) and `rateHistory` (per-grade, admin sets a rate effective from a date, `/admin/rates`; old pay slips keep using whatever rate was actually in effect, same append-only-ledger pattern as everything else). Core: `/admin/payslips` — pick supplier + month, computes gross per grade (`src/lib/computePayslip.ts`, each entry priced at the rate in effect on *its own* date, so a mid-period rate change is handled correctly), lets admin pick which outstanding deductions to apply, blocks generation if a grade in the period has no rate set yet or if the period overlaps an existing pay slip for that supplier (`periodsOverlap`), then writes the pay slip and marks its deductions applied in one batch (`generatePayslip`) so the two writes can't land only one at a time. A pay slip is a full point-in-time **snapshot** (supplier name, grade names, every line's amount all copied in at generation time) — later renames or rate changes never retroactively alter a past pay slip, and the doc itself is immutable once created (no update/delete in rules). PDF: `/admin/payslips` and `/supplier/payslips` both render via `@react-pdf/renderer` client-side (`src/components/PayslipDocument.tsx`, `downloadPayslipPdf.ts`) straight from the stored pay slip doc — nothing server-side, nothing in Storage. Firestore rules: `grades` read by admin+collector, write by admin; `rateHistory` and `payslips` admin-only read/write (supplier reads only their own pay slips). New composite indexes: `requests`/`advances`/`deductions`/`payslips` each `supplierId + <field> desc` (added across this phase and Phase 5).
- **Phase 4 — done.** Dashboards for all three roles: today / last-7-days / this-month stat tiles + a trailing-6-month bar chart (`src/lib/aggregateCollections.ts` shared across all three, `src/components/StatTile.tsx` + `SixMonthChart.tsx` shared UI). Supplier and Collector dashboards show their own totals (`useSupplierCollections`/`useCollectorCollections`); Admin dashboard shows company-wide totals plus supplier-wise and collector-wise month-to-date breakdown tables (`useAllCollections`, admin-only per existing rules — no rule changes needed this phase). Chart follows the dataviz skill's non-negotiables: single sequential hue per single-series chart (no legend needed), no dual axis, thin rounded bars, recessive gridlines, hover tooltip. No new Firestore rules/indexes required.
- **Phase 3 — done.** `collections` collection (leaf entries): `/collector/collections/add` (supplier picker restricted to active suppliers, date, quantity), `/collector/collections` (own history — daily view with a from/to filter + running total, monthly view grouped across all history), `/collector/suppliers` (read-only roster — the "Supplier list" requirement, view-only by page design and enforced regardless by rules). Entries are an append-only ledger — no update/delete in rules or UI yet; corrections are a later decision, not a silent edit. Firestore rules: a collector can only create entries under their own `collectorId`/`createdBy`; reads scoped to admin, the owning collector, or (for later phases) the named supplier. Added composite indexes for `collectorId+date` (used now) and `supplierId+date` (reserved for the supplier's own dashboard/history in Phase 4).

## 8. Explicit assumptions to confirm

1. Pay computed as `Σ(collection.quantityKg) × current rate/kg` for the pay-slip period, minus approved deductions — **needs confirmation**.
2. Supplier/Collector IDs are admin-assigned, sequential (e.g. `SUP-0001`) — not self-chosen.
3. "6-month graph" = 6 trailing calendar months, monthly totals (not daily granularity).
4. Pay-slip period defaults to monthly (weekly pay slips not in v1 unless told otherwise).
