# Stage 4: Enquiry Tracking and Visit Effectiveness

## Stage Objective
Measure how field visits convert into enquiries and shipments, and identify productivity gaps by salesperson and management hierarchy.

## Business Context
High visit volume without enquiry generation indicates low visit quality. The business needs explicit visit-to-enquiry and enquiry-to-shipment effectiveness tracking.

## Terminology Used
- Enquiry: potential business created from visit.
- Shipment conversion: realized outcome from enquiry.
- Effectiveness:
  - visit-to-enquiry ratio
  - enquiry-to-shipment ratio

## Current Implementation (As-Is)
- Data capture already present:
  - `enquiriesReceived`
  - `shipmentsConverted`
  - per daily actual row (`WeeklyReport.actualOutputRows`).
- Admin insights endpoint (`/api/admin/insights`) computes:
  - enquiry-to-shipment conversion rate
  - enquiries per visit
  - shipments per visit
  - conversion by customer type and visit type
  - productivity tables by salesperson/location/customer
  - average lag from first enquiry to later shipment (proxy method)
- Missing in current system:
  - explicit HOD-level performance framing.
  - formal “high visits, low enquiry” exception flags with threshold policy.

## Target Requirement (To-Be)
- Track enquiries generated from visits.
- Measure visit-to-enquiry conversion ratio.
- Measure enquiry generation ratio per salesperson and per HOD.
- Identify performance gaps:
  - high visit count + low enquiry generation.
  - high enquiry + low shipment conversion.

## Gap Analysis (As-Is vs To-Be)
- Exists:
  - Core enquiry and shipment metrics.
  - Multi-dimensional insights API and dashboard elements.
- Partial:
  - Effectiveness analytics exist but not explicitly aligned to HOD hierarchy requirement language.
  - Gap flags are inferable but not codified as alert rules.
- Missing:
  - Standard threshold policy for low effectiveness.
  - HOD-centric scorecard and accountability drilldown.

## Detailed Functional Requirements
### KPI Formulas
- Visit-to-Enquiry Ratio:
  - `totalEnquiries / actualVisits`.
- Enquiry-to-Shipment Conversion:
  - `totalShipments / totalEnquiries`.
- Salesperson effectiveness:
  - same KPIs at individual level.
- HOD effectiveness:
  - aggregated KPIs across mapped team members.

### Gap/Exception Rules
- “High Visits, Low Enquiry” flag:
  - Trigger when visits exceed configurable threshold and enquiry ratio is below threshold.
- “Low Conversion” flag:
  - Trigger when enquiry volume is above minimum but shipment conversion stays below target.

## Reporting & Dashboard Requirements
- Mandatory views:
  - KPI cards for top-level effectiveness metrics.
  - trend charts by date/week.
  - salesperson ranking table.
  - HOD/team roll-up table.
  - flagged low-effectiveness cohort list.
- Filters:
  - date range, salesperson, HOD/admin, visit type, customer type, location.

## Data Requirements
- Source:
  - `actualOutputRows.enquiriesReceived`, `actualOutputRows.shipmentsConverted`, `actualOutputRows.visited`.
  - planning context for visit type/customer type.
- Derived:
  - ratio metrics, lag metrics, exception flags.

## Acceptance Criteria
- Stage 4 documentation defines:
  - each effectiveness KPI formula.
  - threshold-driven gap detection rules.
  - salesperson and HOD reporting expectations.

## Dependencies / Out of Scope for This Stage
- Depends on hierarchy model and consistent owner mapping.
- Out of scope:
  - non-visit reason taxonomy (Stage 3).
  - follow-up/quality exception framework (Stage 5).
