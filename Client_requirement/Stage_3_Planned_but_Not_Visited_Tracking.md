# Stage 3: Planned but Not Visited Tracking

## Stage Objective
Capture and analyze missed planned visits with mandatory reasons, trends, and repeat behavior at customer and salesperson level.

## Business Context
Missed visits reduce pipeline quality and planning credibility. The business needs structured reason capture and recurrence tracking to identify controllable execution gaps.

## Terminology Used
- Planned visit: a meaningful row in planning schedule.
- Not visited: actual row marked `visited = no`.
- Non-visit reason: mandatory narrative for missed planned activity.

## Current Implementation (As-Is)
- Actual output row contains `visited` (`yes/no`) and `notVisitedReason`.
- Validation already enforced:
  - If `visited = no`, `notVisitedReason` is required (`backend/utils/weeklyReportRows.js`).
- Admin can inspect row-level missed visits in `AdminSalesmenStatusPage`.
- What is not yet formalized:
  - Controlled reason categories.
  - Recurrence tracking by customer/reason over time.
  - Dedicated “planned-but-not-visited” summary widgets.

## Target Requirement (To-Be)
- Track count of customers planned but not visited.
- Capture mandatory reason for each non-visit.
- Categorize reasons into business-defined buckets, for example:
  - client unavailable
  - no response
  - internal engagement
  - travel/logistics issue
- Persist and surface repeated non-visit cases for same customer over time.

## Gap Analysis (As-Is vs To-Be)
- Exists:
  - Required reason capture for `visited = no`.
  - Row-level visibility in admin pages.
- Partial:
  - Data supports analytics but no dedicated stage metrics or recurrence logic.
- Missing:
  - Standard reason taxonomy and category analytics.
  - Repeat non-visit alerts by customer/salesperson.

## Detailed Functional Requirements
### Capture Rules
- If a planned row exists and actual `visited = no`, reason is mandatory.
- Reason entry should support:
  - predefined category
  - optional free-text detail

### Classification Rules
- Non-visit summary metrics:
  - total planned-but-not-visited count.
  - count by reason category.
  - count by salesperson/team.
- Repeat detection:
  - Same customer with non-visit in multiple consecutive or frequent weeks.

### Operational Workflow
- Salesperson must submit reason before saving actual output.
- Admin must be able to review and identify chronic non-visit patterns.

## Reporting & Dashboard Requirements
- Stage 3 dashboard must include:
  - Weekly missed visit total and trend.
  - Reason-category distribution chart.
  - Top repeated non-visit customers.
  - Salesperson-wise non-visit rate.
- Filters:
  - Week/date range, salesperson, admin/HOD, reason category, customer.

## Data Requirements
- Source:
  - `WeeklyReport.planningRows.date/customerName`
  - `WeeklyReport.actualOutputRows.visited/notVisitedReason`
- Additional future fields recommended:
  - `notVisitedReasonCategory` (enum)
  - repeat counters per customer/time-window.

## Acceptance Criteria
- Stage 3 documentation clearly defines:
  - what counts as planned-but-not-visited.
  - mandatory reason handling and categorization.
  - recurrence logic and expected outputs.

## Dependencies / Out of Scope for This Stage
- Depends on consistent customer name normalization or unique customer identifier strategy.
- Out of scope:
  - call compliance thresholds (Stage 2).
  - enquiry conversion metrics (Stage 4).
