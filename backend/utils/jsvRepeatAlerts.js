function normalizeCustomerKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildInactiveAlert(threshold) {
  return {
    active: false,
    threshold,
    customers: [],
    message: '',
  };
}

function buildAlertMessage(customers, threshold) {
  if (!Array.isArray(customers) || customers.length === 0) {
    return '';
  }

  const summary = customers.map((customer) => `${customer.customerName} (${customer.count})`).join(', ');
  return `JSV alert: same customer appears more than ${threshold} times. Triggered customers: ${summary}`;
}

function buildJsvRepeatAlertsBySalesman({ reports = [], threshold = 3 } = {}) {
  const customerCountsBySalesman = new Map();

  for (const report of reports) {
    const salesmanId = String(report?.salesmanId || '');
    if (!salesmanId) {
      continue;
    }

    if (!customerCountsBySalesman.has(salesmanId)) {
      customerCountsBySalesman.set(salesmanId, new Map());
    }

    const customerCounts = customerCountsBySalesman.get(salesmanId);

    for (const row of report?.planningRows || []) {
      if (String(row?.contactType || '').trim().toLowerCase() !== 'jsv') {
        continue;
      }

      const normalizedKey = normalizeCustomerKey(row?.customerName);
      if (!normalizedKey) {
        continue;
      }

      if (!customerCounts.has(normalizedKey)) {
        customerCounts.set(normalizedKey, {
          customerName: String(row?.customerName || '').trim(),
          count: 0,
        });
      }

      const customerEntry = customerCounts.get(normalizedKey);
      customerEntry.count += 1;
      if (!customerEntry.customerName) {
        customerEntry.customerName = String(row?.customerName || '').trim();
      }
    }
  }

  const alertsBySalesman = new Map();

  for (const [salesmanId, customerCounts] of customerCountsBySalesman.entries()) {
    const customers = Array.from(customerCounts.values())
      .filter((entry) => entry.count > threshold)
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.customerName.localeCompare(b.customerName);
      });

    if (customers.length === 0) {
      alertsBySalesman.set(salesmanId, buildInactiveAlert(threshold));
      continue;
    }

    alertsBySalesman.set(salesmanId, {
      active: true,
      threshold,
      customers,
      message: buildAlertMessage(customers, threshold),
    });
  }

  return alertsBySalesman;
}

module.exports = {
  buildInactiveAlert,
  buildJsvRepeatAlertsBySalesman,
};
