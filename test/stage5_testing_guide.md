# Stage 5 Exception & Quality Monitoring Testing Guide

This guide verifies Stage 5 implementation end-to-end: exception rule detection, case lifecycle updates, and admin dashboard behavior.

## 1. Backend Logic (Unit Tests)

Run Stage 5 utility tests and full backend tests.

```bash
cd backend

# Stage 5 utility tests
node --test utils/stage5ExceptionQuality.test.js

# Full backend suite
npm test
```

## 2. API Endpoint Verification

These endpoints require an authenticated admin session.

### 2.1 Get Stage 5 Dashboard Data

```bash
curl -b cookies.txt "http://localhost:5000/api/admin/stage5-exception-quality?from=2026-W06&to=2026-W08"
```

Verify response includes:
- `range`
- `summary.openByRule`
- `summary.ageingBuckets`
- `summary.ownerBacklog`
- `summary.resolvedVsOpenTrend`
- `exceptions.rows`
- `filterOptions`

### 2.2 Filter Validation

```bash
curl -b cookies.txt "http://localhost:5000/api/admin/stage5-exception-quality?rule=EX-03&status=open&ageingBucket=15+"
```

Verify all returned rows match selected filters.

### 2.3 Status Update

```bash
curl -X PATCH -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"status":"in_review","note":"Working this week"}' \
  "http://localhost:5000/api/admin/stage5-exception-quality/<CASE_ID>/status"
```

Verify:
- `case.status` changes
- `statusHistoryTail` contains transition record

### 2.4 Timeline Drilldown

```bash
curl -b cookies.txt "http://localhost:5000/api/admin/stage5-exception-quality/<CASE_ID>/timeline"
```

Verify timeline rows are ordered by date and reflect visited journey activity.

## 3. Rule Validation Scenarios

Use seeded/manual data and confirm expected rule outputs:

1. EX-01: Customer visited exactly once in selected range.
2. EX-02: Customer visited more than once and total enquiries is 0.
3. EX-03: Customer visited more than once and total JSV count is 0.
4. EX-04: Customer has at least 3 visited FC/SC rows and total shipments is 0.

Also verify one customer can appear under multiple rules as separate cases.

## 4. Frontend Verification

### Stage 5 Page Access

1. Login as Admin.
2. Open `/admin/stage5-exception-quality`.
3. Confirm Stage 5 tab appears in admin section tabs.

### Dashboard and Filters

1. Validate KPI cards: open totals and rule-wise open counts.
2. Validate ageing cards: `0-7`, `8-14`, `15+`.
3. Validate charts: opened vs resolved trend.
4. Apply filters (date, salesperson, team, admin, rule, status, ageing bucket, customer).
5. Confirm table rows update consistently with filters.

### Lifecycle Actions

1. Pick an open case.
2. Change status to `in_review`, add note, click Update.
3. Change status to `resolved`, verify row/badges update.
4. Re-open (`resolved -> open`) and verify success.
5. Confirm invalid transition is rejected by API (for example `resolved -> ignored`).

## 5. Regression Checks

Run:

```bash
cd frontend
npm run lint
```

Ensure no regressions in existing Stage 1-4 pages after adding Stage 5 route/tab.
