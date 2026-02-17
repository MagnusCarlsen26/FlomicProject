# Stage 1: Plan vs Actual Tracking

## Stage Objective
Define how planned customer visits are captured, how actual execution is captured, and how achievement is measured daily, weekly, and monthly across sales hierarchy.

## Business Context
This stage is the base control mechanism for field-sales execution. Without reliable plan-vs-actual tracking, downstream compliance, conversion, and exception analytics are not trustworthy.

## Terminology Used
- Activity types and call nature follow `Client_requirement/Terminology.md`.
- Relevant call types in system: `NC`, `FC`, `JSV`, `SC`.
- Customer type in system: `Targeted (Budgeted)`, `Existing`.

## Current Implementation (As-Is)
- Salesman fills a 7-row weekly planning sheet and a 7-row weekly actual output sheet.
- Backend auto-creates one `WeeklyReport` per user per current IST week (`backend/index.js`, `getOrCreateCurrentWeekReport`).
- Planning rows include:
  - `date`, `isoWeek`, `customerName`, `locationArea`, `customerType`, `contactType`, `jsvWithWhom`
- Actual rows include:
  - `date`, `isoWeek`, `visited`, `notVisitedReason`, `enquiriesReceived`, `shipmentsConverted`
- Key validations already enforced (`backend/utils/weeklyReportRows.js`):
  - Exactly 7 rows per section.
  - Date must belong to current week.
  - `visited = no` requires `notVisitedReason`.
  - Numeric outputs must be non-negative integers.
  - `contactType = jsv` can reference only admin IDs.
- Admin side:
  - Detailed weekly row-level review exists (`/api/admin/salesmen-status`, `frontend/src/pages/AdminSalesmenStatusPage.jsx`).
  - Aggregate planned-vs-actual metrics exist in insights (`/api/admin/insights`, `backend/utils/adminInsights.js`).

## Target Requirement (To-Be)
- Track and expose the following metrics by day, week, and month:
  - Planned visit count.
  - Actual visited count.
  - Variance = Planned - Actual.
  - Achievement % = Actual / Planned.
- Break-up required across hierarchy:
  - Individual salesperson.
  - Admin/HOD ownership.
  - Team roll-up.
- Distinguish metrics by call nature (`NC`, `FC`, `JSV`, `SC`) and customer type where needed.

## Gap Analysis (As-Is vs To-Be)
- Exists:
  - Weekly planning and actual capture.
  - Weekly planned-vs-actual KPI at aggregated level.
- Partial:
  - Hierarchy break-up is not modeled fully beyond role + user filtering.
  - Monthly aggregation is possible from range API but not presented as explicit monthly module.
- Missing:
  - Explicit variance and achievement views by hierarchy layer.
  - Standardized daily/weekly/monthly report cards for business users.

## Detailed Functional Requirements
### User Stories by Role
- Salesperson:
  - Must record weekly plan and actual output against each date.
- Admin:
  - Must view plan-vs-actual for all assigned salespeople.
  - Must view performance aggregated by team layer (individual, admin/HOD, organization).

### Calculation Rules
- Planned Visits:
  - Count planning rows with meaningful visit intent (customer/call data present).
- Actual Visits:
  - Count rows where `visited = yes`.
- Variance:
  - `plannedVisits - actualVisits`.
- Achievement %:
  - `actualVisits / plannedVisits` (0 when denominator is 0).

### Data Rules
- Week lock: edits allowed only for current IST week.
- Planning and actual remain date-aligned (same 7-day structure).

## Reporting & Dashboard Requirements
- Stage 1 dashboard must show:
  - Daily planned vs actual trend.
  - Weekly summary card per salesperson.
  - Monthly roll-up by team/admin.
  - Top over-achievers and under-achievers.
- Mandatory filters:
  - Date range, week, month, salesperson, admin/HOD, call type, customer type.

## Data Requirements
- Primary source: `WeeklyReport.planningRows`, `WeeklyReport.actualOutputRows`.
- Derived fields:
  - `plannedVisits`, `actualVisits`, `variance`, `achievementRate`.
- Required traceability:
  - Ability to drill from aggregate metric down to date-level rows.

## Acceptance Criteria
- Stage 1 documentation clearly defines:
  - Metric formulas.
  - Hierarchy-wise reporting expectations.
  - Date-granularity expectations (daily/weekly/monthly).
- No ambiguity remains in how plan-vs-actual is computed or displayed.

## Dependencies / Out of Scope for This Stage
- Depends on stable user hierarchy mapping (team/admin/HOD assignment model).
- Out of scope:
  - Alerting policy details (covered in Stage 2).
  - Conversion effectiveness logic (covered in Stage 4).
