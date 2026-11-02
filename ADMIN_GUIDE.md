# Blue Hills Tea Factory — Admin Guide

Live app: **https://blue-mount-5e5a6.web.app**

This is the operational guide for whoever administers the system day to day. For how the system is built, see `README.md` (setup/deploy/testing) and `IMPLEMENTATION_PLAN.md` (architecture and every decision behind it).

## The three accounts types

- **Admin** — you. Full access: manage suppliers/collectors, grades/rates, approve requests/advances, generate pay slips.
- **Collector** — field staff who record collections against suppliers.
- **Supplier** — sees their own leaf quantity, pay slips, and can request fertilizer/tea powder or an advance.

Every supplier and collector needs a **login you create for them** — nobody signs themselves up.

## One-time setup

Do this once, in order, before anyone else uses the system.

1. **Grades** (`Grades` in the nav) — add every tea leaf grade you pay differently for (e.g. Grade A, Grade B, Grade C). You can rename or retire a grade later; retiring keeps old records intact, it just removes it from new pickers.
2. **Rates** (`Rates`) — set a starting rate (LKR/kg) for each grade, effective from today. **Pay slips can't be generated for a period until every grade collected in that period has a rate set.**
3. Register your suppliers and collectors (see below).

## Registering suppliers & collectors

Go to `Suppliers` or `Collectors` → **Register**. Fill in name, contact, address, join date — an ID (e.g. `SUP-0001`) is assigned automatically.

Registering someone does **not** give them a login by itself. Open their record (click their ID) → **Login** section → **Create login**: pick an email and a temporary password, and hand those to them directly (there's no automated email — tell them in person, by phone, or however you normally communicate). They should use **Forgot password?** on the login screen the first time to set their own password if you'd rather not manage a temp password handoff — that sends a reset link straight to the email you registered.

**Deactivating** someone (the toggle on their record) immediately blocks their login and revokes their access — this isn't just a UI restriction, it's enforced by the backend security rules, so it holds even if someone tries to bypass the app. Deactivating never deletes anything; all their history stays intact and reappears if you reactivate them.

## Day-to-day: collectors

A collector's app has three things:
- **Add Collection** — pick the supplier, date, grade, and quantity (kg) for each drop-off. One entry per grade — if a supplier drops off two grades the same day, that's two entries.
- **History** — their own entries, with a date-range filter and a monthly summary. Once submitted, an entry can't be edited or deleted (by design — it's a permanent ledger); if a mistake is recorded, tell an admin so it's covered when pay slips are checked.
- **Suppliers** — read-only roster, to know who's active.

## Day-to-day: suppliers

- **Dashboard** — their own today/week/month/6-month leaf quantity.
- **Pay Slips** — list of generated pay slips, each downloadable as a PDF.
- **Requests** — submit a fertilizer/tea powder request; you approve or reject it under `Requests` (admin side).
- **Advances** — request a cash advance; you approve or reject it under `Advances`.
- **Deductions** — a running list of what's been deducted from future pay (from approved advances and fulfilled requests) and whether it's been applied to a pay slip yet.

## Approving requests & advances

- **Requests** (`Requests`): a pending request → **Approve** or **Reject**. Once approved, when the fertilizer/tea powder is actually handed over, come back and **Mark Fulfilled**, entering its cost — that's what creates the deduction against future pay. (Two steps on purpose: approving means "yes, we'll provide this"; fulfilling means "we just did, and here's what it cost.")
- **Advances** (`Advances`): a pending advance → **Approve** or **Reject**. Approving an advance *is* the disbursement — the deduction is created the same moment, since the money has already changed hands.
- **Deductions** (`Deductions`): read-only ledger of everything above, across all suppliers.

## Generating pay slips

Go to `Pay Slips` (admin side):

1. Pick a **supplier** and a **month**.
2. The page shows that period's collections, broken down and priced by grade. If any grade in that period has no rate set, generation is blocked — go set it under `Rates` first.
3. Outstanding deductions for that supplier are listed with checkboxes (all checked by default) — untick anything you don't want applied to this pay slip yet.
4. Check the **Net Pay** total, then **Generate pay slip**.

A pay slip can't be generated for a period that overlaps one already generated for that supplier — this stops the same collections from being paid twice. Once generated, a pay slip is permanent: its numbers are frozen at that moment (even if a supplier is later renamed or a rate changes, past pay slips don't change). If something was wrong, you can't edit it — that's deliberate, so nothing gets silently altered after the fact. Generate a correcting pay slip instead once the underlying issue is fixed going forward.

Both you and the supplier can download the PDF any time from their respective `Pay Slips` pages.

## Known limitations (as of Phase 9)

- **No bulk/CSV import** — suppliers and collectors are registered one at a time.
- **No pay slip correction workflow** — a wrong pay slip can't be edited or voided, only compensated for in a later one.
- **English only.**
- **No SMS/email notifications** — approvals, new pay slips, etc. aren't announced automatically; check the app.
- Built for a **single company** (not multi-tenant) and a **small** supplier/collector count — comfortably within Firebase's free tier as-is, but if it grows into the hundreds, the dashboards' underlying queries (which fetch full history client-side) should move to pre-aggregated summary documents. `IMPLEMENTATION_PLAN.md` flags exactly where.
