const { resolveInsightsRange } = require('./adminInsights');
const { getIsoWeekStringFromDate } = require('./week');

const CONTACT_TYPES = ['nc', 'fc', 'jsv', 'sc'];
const CUSTOMER_TYPES = ['targeted_budgeted', 'existing'];

const DEFAULT_THRESHOLDS = {
  minVisitsForLowEnquiry: 12,
  minEnquiryPerVisit: 0.25,
  minEnquiriesForLowConversion: 6,
  minShipmentConversion: 0.2,
};

function safeDivide(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
}

function roundNumber(value, precision = 4) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function normalizeDateKey(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return '';
  }

  return trimmed;
}

function normalizeContactType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CONTACT_TYPES.includes(normalized) ? normalized : '';
}

function normalizeCustomerType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CUSTOMER_TYPES.includes(normalized) ? normalized : '';
}

function normalizeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function hasMeaningfulPlanningRow(row) {
  if (!row || typeof row !== 'object') {
    return false;
  }

  return [
    String(row.customerName || '').trim(),
    String(row.contactType || '').trim(),
    String(row.locationArea || '').trim(),
    String(row.customerType || '').trim(),
    String(row.jsvWithWhom || '').trim(),
  ].some(Boolean);
}

function buildActualRowByDate(actualRows) {
  const map = new Map();

  for (const row of actualRows || []) {
    const date = normalizeDateKey(row?.date);
    if (!date) {
      continue;
    }

    map.set(date, {
      visited: String(row?.visited || '').trim().toLowerCase(),
      enquiriesReceived: normalizeInteger(row?.enquiriesReceived),
      shipmentsConverted: normalizeInteger(row?.shipmentsConverted),
    });
  }

  return map;
}

function resolveStage4Range(query = {}) {
  return resolveInsightsRange({
    from: query?.from,
    to: query?.to,
  });
}

function normalizeThresholdInput(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function buildThresholds(overrides = {}) {
  return {
    minVisitsForLowEnquiry: normalizeThresholdInput(
      overrides.minVisitsForLowEnquiry,
      DEFAULT_THRESHOLDS.minVisitsForLowEnquiry
    ),
    minEnquiryPerVisit: normalizeThresholdInput(
      overrides.minEnquiryPerVisit,
      DEFAULT_THRESHOLDS.minEnquiryPerVisit
    ),
    minEnquiriesForLowConversion: normalizeThresholdInput(
      overrides.minEnquiriesForLowConversion,
      DEFAULT_THRESHOLDS.minEnquiriesForLowConversion
    ),
    minShipmentConversion: normalizeThresholdInput(
      overrides.minShipmentConversion,
      DEFAULT_THRESHOLDS.minShipmentConversion
    ),
  };
}

function evaluateFlags(metrics, thresholds) {
  const visitToEnquiryRatio = safeDivide(metrics.enquiries, metrics.actualVisits);
  const enquiryToShipmentConversion = safeDivide(metrics.shipments, metrics.enquiries);

  const flags = [];

  if (
    metrics.actualVisits >= thresholds.minVisitsForLowEnquiry &&
    visitToEnquiryRatio < thresholds.minEnquiryPerVisit
  ) {
    flags.push({
      type: 'high_visits_low_enquiry',
      severity: 'warning',
      label: 'High Visits, Low Enquiry',
      reason: `Actual visits ${metrics.actualVisits} with visit-to-enquiry ratio ${roundNumber(visitToEnquiryRatio)} below ${thresholds.minEnquiryPerVisit}.`,
      metrics: {
        actualVisits: metrics.actualVisits,
        enquiries: metrics.enquiries,
        ratio: roundNumber(visitToEnquiryRatio),
      },
      thresholds: {
        minVisitsForLowEnquiry: thresholds.minVisitsForLowEnquiry,
        minEnquiryPerVisit: thresholds.minEnquiryPerVisit,
      },
    });
  }

  if (
    metrics.enquiries >= thresholds.minEnquiriesForLowConversion &&
    enquiryToShipmentConversion < thresholds.minShipmentConversion
  ) {
    flags.push({
      type: 'low_conversion',
      severity: 'critical',
      label: 'Low Conversion',
      reason: `Enquiries ${metrics.enquiries} with enquiry-to-shipment conversion ${roundNumber(enquiryToShipmentConversion)} below ${thresholds.minShipmentConversion}.`,
      metrics: {
        enquiries: metrics.enquiries,
        shipments: metrics.shipments,
        ratio: roundNumber(enquiryToShipmentConversion),
      },
      thresholds: {
        minEnquiriesForLowConversion: thresholds.minEnquiriesForLowConversion,
        minShipmentConversion: thresholds.minShipmentConversion,
      },
    });
  }

  return flags;
}

function buildStage4Payload({ users, reports, range, filters = {}, thresholds = DEFAULT_THRESHOLDS }) {
  const normalizedThresholds = buildThresholds(thresholds);

  const filterSalesmen = new Set((filters.salesmen || []).map((id) => String(id)));
  const filterTeam = String(filters.team || '').trim();
  const filterVisitType = normalizeContactType(filters.visitType);
  const filterCustomerType = normalizeCustomerType(filters.customerType);
  const filterLocation = String(filters.location || '').trim().toLowerCase();
  const filterAdmin = String(filters.admin || '').trim();

  const fromDate = String(range?.fromWeek?.startDate || '').trim();
  const toDate = String(range?.toWeek?.endDate || '').trim();

  const usersById = new Map();
  const salesmenOptions = [];
  const teamOptionsSet = new Set();
  const adminOptions = [];

  for (const user of users || []) {
    const id = String(user._id);
    const team = String(user.team || 'Unassigned').trim() || 'Unassigned';
    const normalizedUser = {
      id,
      name: user.name || '',
      email: user.email || '',
      role: String(user.role || '').trim().toLowerCase(),
      team,
    };

    usersById.set(id, normalizedUser);
    salesmenOptions.push({ id, name: normalizedUser.name || normalizedUser.email });
    teamOptionsSet.add(team);

    if (normalizedUser.role === 'admin') {
      adminOptions.push({ id, name: normalizedUser.name || normalizedUser.email });
    }
  }

  const salespersonMap = new Map();
  const hodMap = new Map();
  const weeklyMap = new Map();
  const locationOptionsSet = new Set();

  let plannedVisits = 0;
  let actualVisits = 0;
  let totalEnquiries = 0;
  let totalShipments = 0;

  for (const report of reports || []) {
    const userId = String(report.salesmanId);
    const user = usersById.get(userId);
    if (!user) {
      continue;
    }

    if (filterSalesmen.size > 0 && !filterSalesmen.has(userId)) {
      continue;
    }

    if (filterTeam && user.team !== filterTeam) {
      continue;
    }

    const actualByDate = buildActualRowByDate(report.actualOutputRows);

    for (const row of report.planningRows || []) {
      if (!hasMeaningfulPlanningRow(row)) {
        continue;
      }

      const dateKey = normalizeDateKey(row.date);
      if (!dateKey || dateKey < fromDate || dateKey > toDate) {
        continue;
      }

      const contactType = normalizeContactType(row.contactType);
      const customerType = normalizeCustomerType(row.customerType);
      const location = String(row.locationArea || '').trim();
      const normalizedLocation = location.toLowerCase();

      if (filterVisitType && contactType !== filterVisitType) {
        continue;
      }
      if (filterCustomerType && customerType !== filterCustomerType) {
        continue;
      }
      if (filterLocation && normalizedLocation !== filterLocation) {
        continue;
      }

      if (filterAdmin && contactType === 'jsv') {
        const jsvWithWhom = String(row.jsvWithWhom || '').trim();
        if (jsvWithWhom !== filterAdmin) {
          continue;
        }
      }

      if (location) {
        locationOptionsSet.add(location);
      }

      const actualRow = actualByDate.get(dateKey) || {
        visited: '',
        enquiriesReceived: 0,
        shipmentsConverted: 0,
      };

      const isVisited = actualRow.visited === 'yes';
      const enquiryCount = actualRow.enquiriesReceived;
      const shipmentCount = actualRow.shipmentsConverted;

      plannedVisits += 1;
      if (isVisited) {
        actualVisits += 1;
      }
      totalEnquiries += enquiryCount;
      totalShipments += shipmentCount;

      if (!salespersonMap.has(userId)) {
        salespersonMap.set(userId, {
          salespersonId: userId,
          salespersonName: user.name || user.email,
          team: user.team,
          plannedVisits: 0,
          actualVisits: 0,
          enquiries: 0,
          shipments: 0,
        });
      }

      const salespersonEntry = salespersonMap.get(userId);
      salespersonEntry.plannedVisits += 1;
      if (isVisited) {
        salespersonEntry.actualVisits += 1;
      }
      salespersonEntry.enquiries += enquiryCount;
      salespersonEntry.shipments += shipmentCount;

      const hodKey = user.team || 'Unassigned';
      if (!hodMap.has(hodKey)) {
        hodMap.set(hodKey, {
          hod: hodKey,
          plannedVisits: 0,
          actualVisits: 0,
          enquiries: 0,
          shipments: 0,
          salespeople: new Set(),
        });
      }

      const hodEntry = hodMap.get(hodKey);
      hodEntry.plannedVisits += 1;
      if (isVisited) {
        hodEntry.actualVisits += 1;
      }
      hodEntry.enquiries += enquiryCount;
      hodEntry.shipments += shipmentCount;
      hodEntry.salespeople.add(userId);

      const isoWeek = getIsoWeekStringFromDate(new Date(`${dateKey}T00:00:00.000Z`));
      if (!weeklyMap.has(isoWeek)) {
        weeklyMap.set(isoWeek, {
          week: isoWeek,
          plannedVisits: 0,
          actualVisits: 0,
          enquiries: 0,
          shipments: 0,
        });
      }
      const weekEntry = weeklyMap.get(isoWeek);
      weekEntry.plannedVisits += 1;
      if (isVisited) {
        weekEntry.actualVisits += 1;
      }
      weekEntry.enquiries += enquiryCount;
      weekEntry.shipments += shipmentCount;
    }
  }

  const flagRows = [];

  const salespersonRows = Array.from(salespersonMap.values())
    .map((row) => {
      const visitToEnquiryRatio = roundNumber(safeDivide(row.enquiries, row.actualVisits));
      const enquiryToShipmentConversion = roundNumber(safeDivide(row.shipments, row.enquiries));
      const flags = evaluateFlags(row, normalizedThresholds);

      for (const flag of flags) {
        flagRows.push({
          scope: 'salesperson',
          id: row.salespersonId,
          name: row.salespersonName,
          team: row.team,
          ...flag,
        });
      }

      return {
        ...row,
        visitToEnquiryRatio,
        enquiryToShipmentConversion,
        flags,
      };
    })
    .sort((a, b) => {
      if (b.enquiries !== a.enquiries) {
        return b.enquiries - a.enquiries;
      }
      return b.actualVisits - a.actualVisits;
    });

  const hodRows = Array.from(hodMap.values())
    .map((row) => {
      const visitToEnquiryRatio = roundNumber(safeDivide(row.enquiries, row.actualVisits));
      const enquiryToShipmentConversion = roundNumber(safeDivide(row.shipments, row.enquiries));
      const flags = evaluateFlags(row, normalizedThresholds);

      for (const flag of flags) {
        flagRows.push({
          scope: 'hod',
          id: row.hod,
          name: row.hod,
          team: row.hod,
          ...flag,
        });
      }

      return {
        hod: row.hod,
        salespeopleCount: row.salespeople.size,
        plannedVisits: row.plannedVisits,
        actualVisits: row.actualVisits,
        enquiries: row.enquiries,
        shipments: row.shipments,
        visitToEnquiryRatio,
        enquiryToShipmentConversion,
        flags,
      };
    })
    .sort((a, b) => {
      if (b.enquiries !== a.enquiries) {
        return b.enquiries - a.enquiries;
      }
      return b.actualVisits - a.actualVisits;
    });

  const weeklyRows = Array.from(weeklyMap.values())
    .map((row) => ({
      ...row,
      visitToEnquiryRatio: roundNumber(safeDivide(row.enquiries, row.actualVisits)),
      enquiryToShipmentConversion: roundNumber(safeDivide(row.shipments, row.enquiries)),
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const flagSummary = {
    total: flagRows.length,
    byType: {
      high_visits_low_enquiry: flagRows.filter((item) => item.type === 'high_visits_low_enquiry').length,
      low_conversion: flagRows.filter((item) => item.type === 'low_conversion').length,
    },
    bySeverity: {
      warning: flagRows.filter((item) => item.severity === 'warning').length,
      critical: flagRows.filter((item) => item.severity === 'critical').length,
    },
  };

  return {
    range: {
      from: range.fromWeek.startDate,
      to: range.toWeek.endDate,
      fromWeek: range.fromWeek.isoWeek,
      toWeek: range.toWeek.isoWeek,
      timezone: range.timezone,
      weeks: range.weeks,
    },
    appliedFilters: {
      salesmen: Array.from(filterSalesmen),
      team: filterTeam || null,
      visitType: filterVisitType || null,
      customerType: filterCustomerType || null,
      location: filterLocation || null,
      admin: filterAdmin || null,
      thresholds: normalizedThresholds,
    },
    totals: {
      plannedVisits,
      actualVisits,
      enquiries: totalEnquiries,
      shipments: totalShipments,
    },
    kpis: {
      visitToEnquiryRatio: {
        value: roundNumber(safeDivide(totalEnquiries, actualVisits)),
        numerator: totalEnquiries,
        denominator: actualVisits,
      },
      enquiryToShipmentConversion: {
        value: roundNumber(safeDivide(totalShipments, totalEnquiries)),
        numerator: totalShipments,
        denominator: totalEnquiries,
      },
    },
    trends: {
      weekly: weeklyRows,
    },
    tables: {
      salesperson: salespersonRows,
      hod: hodRows,
    },
    flags: {
      summary: flagSummary,
      rows: flagRows,
    },
    filterOptions: {
      salesmen: salesmenOptions,
      team: Array.from(teamOptionsSet).sort((a, b) => a.localeCompare(b)),
      visitType: CONTACT_TYPES,
      customerType: CUSTOMER_TYPES,
      location: Array.from(locationOptionsSet).sort((a, b) => a.localeCompare(b)),
      admin: adminOptions,
    },
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  safeDivide,
  resolveStage4Range,
  buildStage4Payload,
};
