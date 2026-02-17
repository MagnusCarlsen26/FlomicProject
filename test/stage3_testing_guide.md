# Stage 3 Planned-but-Not-Visited Testing Guide

This guide describes how to verify the Stage 3 Planned-but-Not-Visited Tracking implementation.

## 1. Backend Logic (Unit Tests)

You can run the unit tests for the analytics utility and row normalization to validate the counting, recurrence detection, and validation logic.

```bash
cd backend
# Run analytics utility tests
npm test utils/stage3PlannedNotVisited.test.js

# Run row normalization tests
npm test utils/weeklyReportRows.test.js
```

## 2. API Endpoint Verification

Verify the admin API endpoint using `curl` or Postman. This requires a valid admin session cookie.

```bash
# Example curl (requires admin session)
curl -b cookies.txt http://localhost:5000/api/admin/stage3-planned-not-visited?week=2026-W08
```

## 3. Frontend Verification

### Salesman Data Entry

1. Login as a **Salesman**.
2. Navigate to the **"Salesman"** page.
3. In the **"Actual Output"** table:
   - Set **"Visited"** to **"No"** for a row.
   - Verify that the **"Not Visited Category"** dropdown becomes enabled.
   - Try to save without selecting a category; it should show a validation error.
   - Select a category (e.g., "Client Unavailable") and enter a reason.
   - Save the output and verify success.
   - Change **"Visited"** back to **"Yes"** and verify that "Reason" and "Category" are cleared and disabled.

### Admin Dashboard

1. Login as an **Admin**.
2. Navigate to the Admin section.
3. Click on the **"Stage 3"** tab.
4. **KPI Cards**: Verify "Planned Visits", "Missed Visits", and "Non-Visit Rate" reflect the filtered data.
5. **Weekly Trend**: Check the bar chart for historical non-visit rates.
6. **Reason Distribution**: Verify the pie chart correctly categorizes the reasons for missed visits.
7. **Repeated Non-Visits**:
   - Check the list of customers with missed visits in at least 2 distinct weeks within the last 8 weeks.
   - Verify "Dominant Reason" shows the most frequent category for that customer.
8. **Drilldown**: Scroll to the "Detailed Drilldown" to see individual record details.

### Filters

- **Search**: Search for specific salesmen by name or email.
- **Date/Week/Month**: Test different time aggregations.
- **Salespeople**: Test multi-select filtering for specific individuals.
- **Team Hierarchy**: Filter by Main Team, Team, or Sub Team to see department-level stats.
- **Reason Category**: Filter the entire dashboard by a specific reason (e.g., only see "Travel/Logistics Issue" trends).

## 4. Recurrence Detection Rule

The "Repeated Non-Visits" feature uses an **8-week rolling window** relative to the end of your selected range. A customer is flagged if they have a planned visit marked as "No" in **2 or more distinct weeks** within that 8-week period.
