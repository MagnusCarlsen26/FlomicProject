# Sales Visit Monitoring & Control – Requirements

## 1. Plan vs Actual Tracking

* **Metrics:**
  * Number of customers planned for visits (Daily / Weekly / Monthly).
  * Number of actual visits completed against the plan.
  * Variance (Planned vs Actual).
  * % Achievement of visit plan.
* **Hierarchy:** Break-up by Admin and Salesperson.

## 2. Activity Compliance Alerts

### A. Admin Monitoring

* **Target:** Minimum 5 Joint Sales Visits (JSVs) per week to be conducted by each Sales Admin along with their respective salespersons.
* **Alerts:** Trigger if weekly JSV count is below 5.
* **Analytics:** Visibility of JSV distribution across team members to ensure equal participation.

### B. Salesperson Monitoring

* **Target:** Each salesperson must complete a minimum of 20 sales calls per week, distributed as:
  * 5 calls with new customers.
  * 5 calls as JSVs.
  * Remaining calls as follow-ups or service-related visits.
* **System Alerts:**
  * Total calls < 20.
  * New customer calls < 5.
  * JSV calls < 5.
  * Excessive service visits with low new business focus.

## 3. Planned but Not Visited Tracking

* **Metrics:** Count of customers planned but not visited.
* **Data Entry:** Mandatory reason capture for non-visit.
* **Categorization:** Summary of non-visit reasons (e.g., client unavailable, internal engagement, travel issue, no response).
* **Persistence:** Repeat non-visit tracking for the same customer.

## 4. Enquiry Tracking & Visit Effectiveness

* **Generation:** Enquiries generated from customer visits.
* **Correlation:** Visit vs Enquiry correlation (Conversion Ratio).
* **Performance:** Enquiry generation ratio per salesperson and per HOD.
* **Gap Analysis:** Identification of salespersons with high visits but low enquiry generation.

## 5. Exception & Quality Monitoring

* **Follow-up Gaps:** List of customers visited only once (no follow-up).
* **Low Performance Indicators:** Customers visited more than once but:
  * No enquiry generated.
  * No JSV conducted.
* **Stagnation:** Customers with repeated follow-ups but no business progress.
