# Stage 5: Exception and Quality Monitoring

## Stage Objective
Define advanced quality-control exceptions that identify low-value visit patterns and stalled customer journeys.

## Business Context
Volume metrics alone are insufficient. Business requires exception intelligence to detect whether follow-up behavior is meaningful and progressing toward business outcomes.

## Terminology Used
- Follow-up gap: customer visited once with no subsequent follow-up.
- Low-performance repeat: customer visited multiple times without enquiry or without JSV intervention.
- Stagnation: repeated follow-ups without business progression.

## Current Implementation (As-Is)
- Available data already supports exception analysis:
  - customerName, contactType, visited, enquiries, shipments per date.
- Existing analytics/tables (`/api/admin/insights`) provide productivity rankings by customer/salesperson/location.
- Current exception logic present:
  - JSV repeat alert for same customer over threshold (`backend/utils/jsvRepeatAlerts.js`).
- Missing in current system:
  - dedicated exception definitions for one-time visits, no-follow-up, stagnant follow-ups.
  - explicit quality-monitoring dashboard section with rule outcomes.

## Target Requirement (To-Be)
- Provide exception lists for:
  - Customers visited only once (no follow-up).
  - Customers visited more than once but no enquiry generated.
  - Customers visited more than once but no JSV conducted.
  - Customers with repeated follow-ups and no business progress.
- Include clear ownership and ageing so managers can act.

## Gap Analysis (As-Is vs To-Be)
- Exists:
  - Raw event data needed for journey-level exception detection.
  - Partial alerting pattern via JSV repeat alert.
- Partial:
  - Insights can hint at weak performance but lacks formal exception taxonomy.
- Missing:
  - codified exception engine with rule identifiers.
  - action-oriented exception queues with status and ageing.

## Detailed Functional Requirements
### Exception Rules
- Rule EX-01: Single Visit No Follow-up
  - Customer has only one completed visit in analysis window.
- Rule EX-02: Repeat Visit No Enquiry
  - Customer has >1 completed visit and total enquiries = 0.
- Rule EX-03: Repeat Visit No JSV
  - Customer has >1 completed visit and no `contactType = jsv`.
- Rule EX-04: Follow-up Stagnation
  - Customer has repeated FC/SC activity but no meaningful conversion progress.

### Operational Metadata for Each Exception
- Customer name/identifier.
- Assigned salesperson and admin/HOD.
- First seen date, latest seen date, ageing days.
- Current exception status:
  - open, in_review, resolved, ignored.

## Reporting & Dashboard Requirements
- Exception cockpit must include:
  - total open exceptions by rule.
  - ageing buckets (0-7, 8-14, 15+ days).
  - owner-wise backlog.
  - resolved vs open trend.
- Drill-down views:
  - customer journey timeline for each exception case.
- Filters:
  - date range, owner, rule type, ageing bucket, status.

## Data Requirements
- Source:
  - `planningRows.contactType/customerName/date`
  - `actualOutputRows.visited/enquiriesReceived/shipmentsConverted`
- Recommended additions:
  - exception tracking entity with lifecycle status and audit trail.

## Acceptance Criteria
- Stage 5 documentation clearly defines:
  - each exception condition with deterministic rule logic.
  - required operational fields for case management.
  - expected dashboard outputs for monitoring and closure.

## Dependencies / Out of Scope for This Stage
- Depends on robust customer identity normalization across weeks.
- Out of scope:
  - core planning-vs-actual metrics (Stage 1).
  - baseline compliance thresholds (Stage 2).
