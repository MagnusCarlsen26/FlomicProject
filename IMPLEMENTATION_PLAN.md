# Flomic Frontend + Backend Implementation Plan

## Confirmed Decisions

1. Role assignment:
   - All Google sign-ins become `salesman` by default.
   - Admin role is assigned manually in the database (`users.role = 'admin'`).
2. Admin capabilities:
   - Admin dashboard is read-only for now.
   - No admin UI for editing records in this phase.
3. Week timezone:
   - Week boundaries use IST.
4. Salesman editing rules:
   - Salesman can edit during the current week.
   - Once the week is over, edits are blocked.
5. Auth method:
   - Use backend-issued `httpOnly` cookie session (JWT in cookie).
6. Status updates:
   - Use polling.

## High-Level Architecture

1. Frontend routes:
   - `/salesman`
   - `/admin`
2. Route access:
   - `salesman` role -> `/salesman`
   - `admin` role -> `/admin`
3. Authentication:
   - Frontend Google sign-in -> backend token verification -> backend session cookie.
4. Salesman scope:
   - Current week only (planning, actual output, current status).

## UI Plan

### `/salesman`

1. Header:
   - Page title.
   - Logged-in user info.
2. Planning section:
   - Current week table for planning stage.
   - Submit weekly plan action.
3. Actual output section:
   - Current week table for outcomes.
   - Save actuals action.
4. Visibility and permissions:
   - Current week data only.
   - Backend enforces edit cutoff after week end (IST).

### `/admin`

1. Header and controls:
   - Search salesperson.
   - Week filter.
   - Optional status filter.
2. Data presentation:
   - Grouped/expandable salesperson entries.
   - Planning stage details.
   - Actual output details.
   - Current status with badge.
3. Access mode:
   - Read-only.

## Frontend Integration Plan

1. Add routing and guards:
   - Use `react-router-dom`.
   - Protected routes based on role from backend `/api/auth/me`.
2. Proposed files:
   - `frontend/src/pages/SalesmanPage.jsx`
   - `frontend/src/pages/AdminPage.jsx`
   - `frontend/src/pages/LoginPage.jsx`
   - `frontend/src/components/ProtectedRoute.jsx`
   - `frontend/src/context/AuthContext.jsx`
   - `frontend/src/services/api.js`
3. API call behavior:
   - Use `credentials: 'include'`.
   - Centralized fetch wrapper for auth/error handling.
4. Polling:
   - Admin page polls status endpoint every 30s.
   - Pause polling on hidden tab via `visibilitychange`.

## Backend Integration Plan

1. Auth endpoints:
   - `POST /api/auth/google`
   - `GET /api/auth/me`
   - `POST /api/auth/logout`
2. Salesman endpoints:
   - `GET /api/salesman/current-week`
   - `PUT /api/salesman/planning`
   - `PUT /api/salesman/actual-output`
   - `PUT /api/salesman/current-status`
3. Admin endpoint:
   - `GET /api/admin/salesmen-status?week=YYYY-WW&q=...`
4. Models (MongoDB):
   - `users` (googleId, email, name, role)
   - `weekly_reports` (salesmanId, week key/range, planning rows, actual rows, submit flags)
   - `status_updates` (salesmanId, timestamp, status, note)
5. Enforcement rules:
   - Backend computes current IST week.
   - Edit endpoints reject updates for past weeks.

## Google Auth Plan

1. Frontend:
   - Integrate Google Identity Services sign-in.
   - Send Google ID token to backend.
2. Backend:
   - Verify token with Google (`google-auth-library`).
   - Create or find user.
   - Default role = `salesman`.
   - Issue signed JWT in `httpOnly`, `secure`, `sameSite` cookie.
3. Authorization:
   - Middleware validates session cookie.
   - Role middleware restricts endpoint access.

## Delivery Phases

1. Phase 1:
   - Routing skeleton, page shells, and protected route scaffolding.
2. Phase 2:
   - Google auth flow and backend session setup.
3. Phase 3:
   - Salesman current-week APIs + UI integration + IST edit validation.
4. Phase 4:
   - Admin read-only dashboard APIs + UI with search/filter and polling.
5. Phase 5:
   - Final polish, error/loading states, lint/build checks, and manual verification.
