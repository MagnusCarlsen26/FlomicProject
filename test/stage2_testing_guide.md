# Stage 2 Activity Compliance Testing Guide

This guide describes how to verify the Stage 2 Activity Compliance Alerts implementation.

## 1. Backend Logic (Unit Tests)

You can run the standalone unit tests for the compliance engine using Node.js. This validates the counting logic, rule evaluation, and alert generation.

```bash
cd backend
node utils/stage2ActivityCompliance.test.js
```

**Expected Output:**

```
Testing compliance counts for u1...
Testing admin card for u2...
Unit tests passed!
```

## 2. API Endpoint Verification

You can test the API endpoint manually using `curl` or a tool like Postman. Note that this requires a valid session cookie (authenticated as an admin).

```bash
# Example curl (requires session)
curl -b cookies.txt http://localhost:5000/api/admin/stage2-activity-compliance?week=2026-W08
```

## 3. Frontend Verification

### Navigation

1. Login as an **Admin**.
2. Navigate to the Admin section.
3. Click on the **"Stage 2"** tab.

### Features to Test

- **Filters**: Change the week, search for a salesperson, or filter by team.
- **KPI Cards**: Ensure the totals (Compliant/Non-Compliant) match the data in the tables.
- **Salesperson Table**: Check if rule breaches (e.g., < 20 total calls) trigger the correct status chips and alert messages.
- **Admin Monitoring**: Verify that admin JSV targets (5 per week) are shown and any "Uneven Participation" is flagged.
- **Drilldown**: Scroll to the bottom to see individual visited calls for the selected period.

## 4. Compliance Rules Logic

The following rules are applied:

- **Total Calls**: Minimum 20 visited calls per week.
- **New Calls (NC)**: Minimum 5 visited NC calls per week.
- **Joint Sales Visits (JSV)**: Minimum 5 visited JSV calls per week.
- **Service-Heavy**: Triggered if Service Calls (SC) > 50% of total and NC targets are below pace.
- **Admin JSV**: Admin must participate in at least 5 JSVs per week.
- **Uneven Participation**: Triggered if one salesperson contributes > 60% of an admin's JSVs (min 5 total JSVs).
