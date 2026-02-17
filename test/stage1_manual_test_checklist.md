# Stage 1 Manual Test Checklist

## 1. Admin navigation and routing
- Login as admin.
- Verify top nav shows `Stage 1`.
- Open `/admin`, confirm redirect to `/admin/stage1-plan-actual`.
- Confirm existing `/admin/insights` and `/admin/salesmen-status` still work.

## 2. Baseline data load
- On Stage 1 page, verify KPIs/cards/tables/charts load without errors.
- Verify “Last refresh” updates on refresh click.
- Verify empty-state behavior if no matching data.

## 3. Filter behavior
- Test each filter alone and in combinations:
  - `from/to` date range
  - `week`
  - `month`
  - salesperson multiselect
  - `callType`
  - `customerType`
  - `mainTeam`, `team`, `subTeam`
  - search (`q`)
- Confirm `week` disables `month` and vice versa.
- Confirm `week/month` overrides date range.
- Click `Apply`, verify all sections update consistently.
- Click `Reset`, verify filters clear and data returns to default.

## 4. Metric correctness (sample-verified)
- Pick a known salesperson/week and verify manually:
  - `plannedVisits` = meaningful planning rows count
  - `actualVisits` = rows with `visited=yes`
  - `variance = planned - actual`
  - `achievement = actual/planned` (0 when planned is 0)
- Cross-check same totals in:
  - KPI cards
  - weekly/monthly tables
  - hierarchy tables
  - drilldown rows.

## 5. Unknown call type handling
- Use data where planning row is meaningful but `contactType` blank.
- Verify it appears under call type split as `UNKNOWN`.
- Verify totals remain consistent (not dropped).

## 6. Hierarchy rollups
- Ensure users with `mainTeam/team/subTeam` values aggregate correctly in:
  - salesperson rollup
  - main team rollup
  - team rollup
  - sub team rollup
- Verify filtering by hierarchy narrows data correctly.

## 7. Over/under achievers
- Confirm ranking is by achievement rate.
- Confirm users with `plannedVisits < 3` do not appear.
- Validate tie handling looks reasonable (higher planned count tie-break).

## 8. Drilldown traceability
- Verify drilldown row fields: date, week, salesperson, hierarchy labels, customer, location, call type, customer type, visited.
- Confirm drilldown rows align with filtered totals.

## 9. Polling and refresh
- Keep page open >30s; verify silent refresh does not break UI.
- Switch browser tab away and back; verify refresh resumes cleanly.

## 10. Responsive UI
- Test desktop + mobile widths:
  - filter layout usability
  - table horizontal scrolling
  - chart rendering without overlap.

## 11. Backfill flow (once)
- Fill `backend/scripts/data/user_hierarchy_map.json`.
- Run `cd backend && npm run backfill:hierarchy`.
- Reopen Stage 1 page and verify hierarchy options/rollups reflect mapped values.

## 12. Regression checks
- Salesman flows (planning/actual/status updates) still save correctly.
- Admin insights page metrics still load.
- Admin salesmen status page still loads and displays rows.
