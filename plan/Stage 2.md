# Stage 2 Activity Compliance Alerts - Implementation Plan

  ## Summary

  Implement Stage 2 as a computed weekly compliance engine (IST
  week) with admin and salesperson alerts, exposed via a new
  admin API and new admin page. Reuse existing WeeklyReport +
  User data, avoid schema changes for alert lifecycle in this
  stage, and keep current Stage 1/JSV-repeat behavior intact.

  ## Scope

  - In scope:
      - Weekly compliance counters from meaningful planning rows
        joined with actual visited outcomes.
      - Salesperson compliance rules and alert generation.
      - Admin JSV weekly compliance and team distribution
        analytics.
      - Summary + drill-down + filters UI for Stage 2.
  - Out of scope:
      - Persistent alert lifecycle (open/ack/resolved/snoozed)
        data model.
      - Non-visit reason analytics (Stage 3+).
      - Enquiry conversion effectiveness (Stage 4+).

  ## Decisions Locked

  - Count basis: visited only.
  - Warning logic: pro-rated pace by IST week progress.
  - Alert storage: computed on-read (no persistence for this
    stage).

  ## Backend Design

  ### 1. New utility module

  - Add backend/utils/stage2ActivityCompliance.js.
  - Export:
      - resolveStage2Range(query):
          - Supports week (required preferred path; fallback
            current week when omitted).
          - Validates YYYY-Www or YYYY-MM-DD via
            resolveWeekFromQuery.
      - buildStage2Payload({ users, reports, range, filters }).

  ### 2. Counting model

  - Row is eligible only when planning row is “meaningful” (same
    standard as Stage 1).
  - Completed call condition:
      - Planning row date exists.
      - Matching actualOutputRows date has visited === 'yes'.
  - Weekly counters per salesperson:
      - totalCalls, ncCount, jsvCount, fcCount, scCount.
  - Rule targets:
      - totalCalls >= 20
      - ncCount >= 5
      - jsvCount >= 5

  ### 3. Severity logic

  - critical:
      - If week closed and target missed.
      - Or at explicit checkpoint date if introduced later (keep
        hook point in code, disabled by default).
  - warning (in-week pro-rated pace):
      - elapsedDays = 1..7 in IST for selected week.
      - expected = ceil(target * elapsedDays / 7).
      - Warn when actual < expected and not already critical.
  - Service-heavy rule:
      - Trigger when scCount / max(totalCalls,1) > 0.5 and
        ncCount < expectedNcPace.
      - Severity warning in active week, critical after week
        close if still true.

  ### 4. Admin monitoring logic

  - Admin weekly JSV count:
      - Count visited jsv rows where planning row jsvWithWhom
        resolves to admin user ID.
  - Rule:
      - adminJsvCount >= 5.
  - Distribution payload for each admin:
      - salespersonBreakdown: { salespersonId, name,
        jsvCountWithAdmin, sharePct }.
      - unevenParticipation flag:
          - True when top contributor share > 60% and at least 5
            total JSV with that admin.

  ### 5. API endpoint

  - Add GET /api/admin/stage2-activity-compliance in backend/
    index.js.
  - Auth: requireAuth, requireRole('admin').
  - Query params:
      - week, q, salesmen, mainTeam, team, subTeam, severity,
        alertType, status.
  - Response shape:
      - week: key/start/end/isoWeek/timezone.
      - summary: compliant/nonCompliant counts, alert breakdown
        by type+severity.
      - salespersonCards: counters + rule evaluations +
        actionable message (current/target/shortfall/
        recommendation).
      - adminCards: admin JSV total + target gap + distribution +
        uneven flag.
      - drilldown: row-level compact entries (salesperson/admin
        context + triggered rules).
      - filterOptions: salesmen/team filters, severity/types/
        status enums.
  - Status field behavior (computed):
      - open for current breaches.
      - resolved when no breach (for filtered views, include only
        when requested).

  ### 6. Non-breaking integration

  - Keep existing:
      - /api/auth/me JSV-repeat alert.
      - /api/admin/salesmen-status.
  - Stage 2 runs independently and does not alter existing
    payload contracts.

  ## Frontend Design

  ### 1. API client

  - Add getAdminStage2ActivityCompliance() in frontend/src/
    services/api.js.
  - Accept same filter object keys as backend query params.

  ### 2. New page

  - Add frontend/src/pages/AdminStage2ActivityCompliancePage.jsx.
  - Layout pattern: mirror Stage 1 page structure for
    consistency.
  - Sections:
      - Header with week range + refresh.
      - Filter bar: week, search, salesperson, team hierarchy,
        severity, alertType, status.
      - KPI cards: compliant vs non-compliant, total alerts,
        critical, warning.
      - Salesperson compliance table/cards with counters and rule
        chips.
      - Admin compliance table/cards with JSV target status and
        distribution table.
      - Drill-down table.

  ### 3. Navigation/routing

  - Add route in frontend/src/App.jsx:
      - /admin/stage2-activity-compliance.
  - Add tab in frontend/src/components/admin/AdminSectionTabs.jsx
    labeled Stage 2.
  - Keep /admin default route unchanged or switch to Stage 1
    based on current behavior (preserve existing default for low
    risk).

  ## Public Interfaces / Contract Additions

  - New backend endpoint:
      - GET /api/admin/stage2-activity-compliance.
  - New frontend service function:
      - getAdminStage2ActivityCompliance(filters).
  - New response contract objects:
      - SalespersonComplianceCard.
      - AdminComplianceCard.
      - RuleAlert with { ruleKey, severity, status, current,
        target, shortfall, message, recommendation }.

  ## Testing Plan

  ### Backend unit tests

  - Add backend/utils/stage2ActivityCompliance.test.js covering:
      - Visited-only counting.
      - NC/JSV/Total threshold breaches.
      - Pro-rated warning in active week.
      - Week-close critical transitions.
      - Service-heavy detection.
      - Admin JSV count by jsvWithWhom ID match.
      - Uneven participation flag logic.
      - Filters (salesmen/team/severity/type/status).

  ### Backend route tests (lightweight)

  - Extend current API test approach or add focused tests for:
      - 400 on invalid week.
      - 200 payload shape with empty users.
      - Role guard for non-admin.

  ### Frontend verification

  - frontend: npm run lint.
  - Manual checks:
      - Filters update data correctly.
      - Severity/type/status filtering works.
      - KPI totals reconcile with table rows.
      - Empty/loading/error states.

  ## Rollout / Risk Controls

  - Ship as additive endpoint + page, no schema migration.
  - Guard expensive operations:
      - Restrict report query to selected week/user subset.
      - Reuse maps for joins to avoid O(n^2).
  - If hierarchy ownership missing:
      - Use jsvWithWhom as admin linkage source of truth for
        Stage 2.
      - Continue exposing team filters from existing
        User.mainTeam/team/subTeam.

  ## Assumptions and Defaults

  - A “completed call” means visited in actualOutputRows;
    planned-only rows do not count.
  - Week boundary is IST Monday-Sunday.
  - Alert lifecycle is computed, not persisted.
  - Current repo has no /plan directory; creation and file save
    are deferred until execution mode.
  - Admin ownership model is not fully formalized; Stage 2 admin
    JSV attribution uses planningRows.jsvWithWhom mapped to admin
    user IDs.