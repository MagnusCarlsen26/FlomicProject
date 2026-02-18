  # Stage 3 Implementation Plan: Planned-but-Not-Visited Tracking

  ## Summary

  Implement Stage 3 end-to-end with:

  1. Strict non-visit reason category enforcement for new/edited
     rows (4 fixed categories).
  2. Backward-compatible handling of legacy uncategorized data.
  3. New admin Stage 3 dashboard route with trends, category
     split, recurrence detection, and filters.
  4. Backend analytics utility + API endpoint + frontend page
     integration.

  Chosen preferences:

  - Reason taxonomy: strict 4 enum
  - Repeat rule: rolling 8 weeks, count >= 2
  - UI placement: new Stage 3 tab/page
  - Legacy strategy: allow uncategorized legacy rows

  ## API / Interface Changes

  ### Data model changes

  - File: backend/models/WeeklyReport.js
  - Add field to actualOutputRowSchema:
      - notVisitedReasonCategory enum: ['', 'client_unavailable',
        'no_response', 'internal_engagement',
        'travel_logistics_issue']
      - default ''
  - Keep existing notVisitedReason text field.

  ### Salesman actual-output validation contract

  - File: backend/utils/weeklyReportRows.js
  - Extend buildDefaultActualOutputRow() with
    notVisitedReasonCategory: ''.
  - Extend normalizeActualOutputRows(rows, week, options):
      - New option inputs:
          - existingRowsByDate (Map)
          - allowLegacyUnchangedMissingCategory (boolean)
      - Validation rules:
          - If visited === 'no', notVisitedReason remains
            mandatory.
          - If visited === 'no', notVisitedReasonCategory
            mandatory unless row is legacy-unchanged and allow-
            flag is true.
          - If visited !== 'no', clear both notVisitedReason and
            notVisitedReasonCategory.
  - Preserve 7-row envelope/date constraints.

  ### Salesman update endpoint compatibility

  - File: backend/index.js (PUT /api/salesman/actual-output)
  - Fetch current report before normalization.
  - Pass options to normalization:
      - existingRowsByDate:
        toExistingRowsByDate(report.actualOutputRows || [])
      - allowLegacyUnchangedMissingCategory: true
  - This allows old uncategorized rows to remain valid only when
    unchanged.

  ### New Stage 3 analytics endpoint

  - File: backend/index.js
  - Add GET /api/admin/stage3-planned-not-visited (admin only).
  - Query filters:
      - from, to, week, month, q, salesmen, mainTeam, team,
        subTeam,
      - reasonCategory, customer
  - Response shape:
      - range
      - filtersApplied
      - totals:
          - plannedButNotVisitedCount
          - plannedVisits
          - nonVisitRate
      - weeklyTrend[]: { isoWeek, plannedButNotVisitedCount,
        nonVisitRate }
      - reasonDistribution[]: { reasonCategory, count } (include
        uncategorized bucket)
      - salespersonRates[]: { id, name, plannedVisits,
        nonVisitedCount, nonVisitRate }
      - topRepeatedCustomers[]: { salesmanId, salesmanName,
        customerName, occurrences8w, lastNonVisitDate,
        dominantReasonCategory }
      - drilldownRows[] (paged/sliced in API to avoid huge
        payloads)
      - filterOptions (salesmen + teams + reason categories)

  ### New Stage 3 analytics utility

  - New file: backend/utils/stage3PlannedNotVisited.js
  - Include:
      - resolveStage3Range (reuse Stage1 style week/month/range
        behavior + max range guard)
      - buildStage3Payload({ users, reports, range, filters })

  ## Implementation Details

  ### Counting logic (definition of planned-but-not-visited)

  - A row qualifies when:
      - planning row is meaningful (hasMeaningfulPlanningRow
        logic), and
      - matching actual row by date has visited === 'no'.
  - Metrics count at row level for weekly totals/distribution/
    rates.

  ### Recurrence detection logic

  - Normalize customer key: trimmed, lowercase, collapse internal
    whitespace.
  - Group by (salesmanId, normalizedCustomerName).
  - Include only qualifying non-visit rows.
  - Rolling window: last 8 ISO weeks in selected range context.
  - Repeat threshold: >= 2 qualifying events.
  - To avoid same-week inflation in repeat list:
      - recurrence count uses distinct week occurrences.
      - keep latest date and total row hits for tie-break
        display.

  ### Legacy behavior

  - Historical rows missing category are reported as
    uncategorized.
  - Editing an uncategorized row requires selecting one of 4
    categories unless unchanged legacy exception applies.
  - New rows from now on must always include category when
    visited=no.

  ## Frontend Changes

  ### Shared constants

  - File: frontend/src/constants/weeklyReportFields.js
  - Add:
      - NOT_VISITED_REASON_CATEGORY_OPTIONS with 4 values + blank
        select
      - helper label formatter for category display

  ### Salesman data-entry UI

  - File: frontend/src/pages/SalesmanPage.jsx
  - Add “Not Visited Category” select column in Actual Output
    table.
  - Behavior:
      - Enabled only when visited === 'no'
      - Reset category when visited changes away from no
  - Keep reason text input alongside category.

  ### Admin Stage 3 page

  - New file: frontend/src/pages/
    AdminStage3PlannedNotVisitedPage.jsx
  - Sections:
      - Filter panel (same style as Stage 1 page + reason/
        category/customer filters)
      - KPI cards
      - Weekly trend chart
      - Reason distribution chart
      - Salesperson non-visit rate table
      - Top repeated customers table
      - Drilldown table
  - Polling/refresh behavior consistent with existing admin
    pages.

  ### Routing and nav

  - File: frontend/src/App.jsx
      - Add route: /admin/stage3-planned-not-visited
  - File: frontend/src/components/admin/AdminSectionTabs.jsx
      - Add Stage 3 tab
  - File: frontend/src/services/api.js
      - Add getAdminStage3PlannedNotVisited(filters)

  ## Tests and Validation

  ### Backend unit tests

  - File: backend/utils/weeklyReportRows.test.js
  - Add cases:
      - requires notVisitedReasonCategory when visited='no'
      - clears category when visited!='no'
      - allows unchanged legacy missing category when option
        enabled
      - rejects changed legacy row still missing category

  ### Backend analytics tests

  - New file: backend/utils/stage3PlannedNotVisited.test.js
  - Cover:
      - planned-but-not-visited counting
      - reason category aggregation including uncategorized
      - salesperson rate computation
      - recurrence detection over 8-week window with >=2
      - same-week dedupe behavior for recurrence count
      - filters: salesperson/team/category/customer/range

  ### Manual frontend checks

  - Salesman form:
      - cannot save new/edited visited=no row without category
      - category resets on visited=yes/blank
  - Admin Stage 3:
      - filters apply/reset correctly
      - charts/tables update and handle empty states
      - recurrence/top customers reflect backend values

  ## Assumptions and Defaults

  - Keep current matching method between planning and actual rows
    by date.
  - No hard migration script for historical data in this stage.
  - uncategorized appears only in analytics output, not as a
    selectable input option.
  - Stage 3 endpoint uses same admin role boundary and range
    limits pattern as Stage 1.
  - Performance baseline: process in-memory aggregation from
    fetched reports in range; optimize later only if needed.