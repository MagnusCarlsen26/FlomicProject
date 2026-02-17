# Stage 2: Activity Compliance Alerts

## Stage Objective
Define compliance rules and automated alerts for admins and salespeople based on minimum weekly activity expectations.

## Business Context
Client requires minimum activity discipline to ensure balanced field effort across new business, guided selling (JSV), and routine follow-ups/service calls.

## Terminology Used
- JSV: Joint Sales Visit with senior member/admin.
- NC: New customer call.
- FC: Follow-up call.
- SC: Service call.

## Current Implementation (As-Is)
- Sales activity data capture exists through planning + actual rows.
- JSV-related controls currently implemented:
  - `contactType = jsv` requires selecting valid admin user ID (`backend/utils/weeklyReportRows.js`).
  - JSV repeat-pattern alert exists:
    - Alerts when same customer appears in JSV more than threshold (default 3).
    - Implemented in `backend/utils/jsvRepeatAlerts.js`.
    - Exposed in `/api/auth/me` and `/api/admin/salesmen-status`.
- Missing in current system:
  - No enforcement/alert for total weekly calls >= 20.
  - No enforcement/alert for NC >= 5 weekly.
  - No enforcement/alert for JSV >= 5 weekly.
  - No “excessive service calls” detection logic.
  - No admin weekly minimum JSV compliance monitor.

## Target Requirement (To-Be)
### A. Admin Monitoring
- Each sales admin must complete minimum 5 JSVs per week with assigned salespeople.
- Trigger alert if admin weekly JSV count < 5.
- Show distribution across team to avoid concentration on a few salespeople.

### B. Salesperson Monitoring
- Each salesperson must complete minimum 20 calls/week, with:
  - NC >= 5
  - JSV >= 5
  - Remaining via FC/SC mix
- Trigger alerts for:
  - Total calls < 20
  - NC < 5
  - JSV < 5
  - SC-heavy mix with weak new business focus

## Gap Analysis (As-Is vs To-Be)
- Exists:
  - Activity categories captured.
  - JSV partner field integrity for current flow.
  - One specialized JSV repeat alert.
- Partial:
  - Admin and salesperson activity can be computed from stored rows, but not operationalized into compliance engine.
- Missing:
  - Rule-based compliance framework, severity, and alert lifecycle.
  - Alert dashboard with acknowledgement/closure workflow.

## Detailed Functional Requirements
### Rule Engine
- Computation window: IST week.
- Inputs: meaningful planned rows + actual visit outcomes.
- Required weekly counters per user:
  - Total calls
  - NC count
  - JSV count
  - FC count
  - SC count
- Alert severity:
  - `warning` near breach threshold.
  - `critical` at confirmed breach after week close or interim checkpoint.

### Admin Alerts
- Admin-level JSV target evaluated weekly.
- Distribution view:
  - JSV count per subordinate salesperson.
  - Uneven participation indicator.

### Salesperson Alerts
- Weekly compliance card per salesperson.
- Alert message must contain:
  - current count, target, shortfall, and recommended action.

## Reporting & Dashboard Requirements
- Compliance summary view:
  - Total users compliant vs non-compliant.
  - Alert type breakdown.
- Drill-down:
  - Salesperson detail with weekly counters and triggered rules.
  - Admin detail with JSV participation spread.
- Filters:
  - Week, salesperson, admin/HOD, alert type, severity, status.

## Data Requirements
- Source:
  - `WeeklyReport.planningRows`, `WeeklyReport.actualOutputRows`, `User.role`.
- Additional data needed (future):
  - Team mapping for admin-subordinate ownership.
  - Alert state tracking (open, acknowledged, resolved, snoozed).

## Acceptance Criteria
- Stage 2 documentation defines:
  - Every compliance rule with threshold and formula.
  - Trigger conditions and alert payload shape.
  - Admin and salesperson views needed for operations.

## Dependencies / Out of Scope for This Stage
- Depends on hierarchy ownership model and role assignments.
- Out of scope:
  - Non-visit reason analytics (Stage 3).
  - Enquiry conversion performance analytics (Stage 4).
