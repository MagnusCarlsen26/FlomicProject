const { IST_TIME_ZONE, getWeekParts, resolveWeekFromQuery, formatDateKey } = require('./week');

const CONTACT_TYPES = ['nc', 'fc', 'sc', 'jsv'];
const CUSTOMER_SEGMENTS = ['new', 'existing'];
const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

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

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (formatDateKey(date) !== trimmed) {
    return '';
  }

  return trimmed;
}

function dateFromKey(dateKey) {
  const normalized = normalizeDateKey(dateKey);
  if (!normalized) {
    return null;
  }

  return new Date(`${normalized}T00:00:00.000Z`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

function getIsoWeekString(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target - yearStart) / MILLISECONDS_PER_DAY + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekList(fromWeekStartUtc, toWeekStartUtc) {
  const weeks = [];
  let cursor = new Date(fromWeekStartUtc);

  while (cursor <= toWeekStartUtc) {
    weeks.push(formatDateKey(cursor));
    cursor = addWeeks(cursor, 1);
  }

  return weeks;
}

function resolveInsightsRange({ from, to, maxWeeks = 52 } = {}) {
  const toWeek = to ? resolveWeekFromQuery(to) : getWeekParts();
  if (!toWeek) {
    return { error: 'Invalid to query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD' };
  }

  let fromWeek;
  if (from) {
    fromWeek = resolveWeekFromQuery(from);
    if (!fromWeek) {
      return { error: 'Invalid from query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD' };
    }
  } else {
    const defaultStart = addWeeks(toWeek.weekStartDateUtc, -11);
    fromWeek = {
      ...toWeek,
      key: formatDateKey(defaultStart),
      startDate: formatDateKey(defaultStart),
      endDate: formatDateKey(addDays(defaultStart, 6)),
      weekStartDateUtc: defaultStart,
      weekEndDateUtc: addDays(defaultStart, 6),
      isoWeek: getIsoWeekString(defaultStart),
    };
  }

  if (fromWeek.weekStartDateUtc > toWeek.weekStartDateUtc) {
    return { error: 'Invalid range: from must be less than or equal to to' };
  }

  const weeks = getWeekList(fromWeek.weekStartDateUtc, toWeek.weekStartDateUtc);
  if (weeks.length > maxWeeks) {
    return { error: `Invalid range: maximum supported range is ${maxWeeks} weeks` };
  }

  return {
    fromWeek,
    toWeek,
    weeks,
    timezone: IST_TIME_ZONE,
  };
}

function hasMeaningfulPlanningRow(row) {
  if (!row || typeof row !== 'object') {
    return false;
  }

  const fields = [
    String(row.customerName || '').trim(),
    String(row.contactType || '').trim(),
    String(row.locationArea || '').trim(),
    String(row.customerType || '').trim(),
    String(row.jsvWithWhom || '').trim(),
  ];

  return fields.some(Boolean);
}

function normalizeContactType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CONTACT_TYPES.includes(normalized) ? normalized : '';
}

function normalizeCustomerSegment(customerType) {
  const normalized = String(customerType || '').trim().toLowerCase();
  if (
    normalized === 'targeted_budgeted' ||
    normalized === 'target_budgeted' ||
    normalized === 'new_customer_non_budgeted'
  ) {
    return 'new';
  }
  if (normalized === 'existing') {
    return 'existing';
  }
  return '';
}

function normalizeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
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

function getWeekday(dateKey) {
  const date = dateFromKey(dateKey);
  if (!date) {
    return 'Unknown';
  }

  const day = date.getUTCDay();
  if (day === 0) {
    return 'Sunday';
  }

  return WEEKDAY_ORDER[day - 1] || 'Unknown';
}

function createBaseBuckets(keys, defaultValueFactory) {
  const map = new Map();
  for (const key of keys) {
    map.set(key, defaultValueFactory());
  }
  return map;
}

function buildInsightsPayload({ users, reports, range }) {
  const notes = [
    'Average enquiry-to-shipment time uses row-date proxy (first enquiry row to first later shipment row per salesperson + customer).',
  ];

  const reportsBySalesperson = new Map();

  for (const report of reports || []) {
    const id = String(report.salesmanId);
    if (!reportsBySalesperson.has(id)) {
      reportsBySalesperson.set(id, []);
    }
    reportsBySalesperson.get(id).push(report);
  }

  const contactDistribution = createBaseBuckets(CONTACT_TYPES, () => ({ count: 0 }));
  const customerConversion = createBaseBuckets(CUSTOMER_SEGMENTS, () => ({ enquiries: 0, shipments: 0 }));
  const visitTypeConversion = createBaseBuckets(CONTACT_TYPES, () => ({ enquiries: 0, shipments: 0 }));
  const weekdayProductivity = createBaseBuckets(WEEKDAY_ORDER, () => ({ enquiries: 0, shipments: 0 }));
  const locationProductivity = new Map();
  const customerProductivity = new Map();

  const salespeople = (users || []).map((user) => ({
    id: String(user._id),
    name: user.name || '',
    email: user.email || '',
  }));

  let plannedVisits = 0;
  let actualVisits = 0;
  let totalEnquiries = 0;
  let totalShipments = 0;

  const lagSamples = [];

  const salespersonProductivity = salespeople.map((salesperson) => {
    const personReports = reportsBySalesperson.get(salesperson.id) || [];
    const activeWeeks = new Set();
    const customerJourneyRows = new Map();

    let personPlannedVisits = 0;
    let personActualVisits = 0;
    let personEnquiries = 0;
    let personShipments = 0;

    for (const report of personReports) {
      const actualByDate = buildActualRowByDate(report.actualOutputRows);

      for (const row of report.planningRows || []) {
        if (!hasMeaningfulPlanningRow(row)) {
          continue;
        }

        const dateKey = normalizeDateKey(row.date);
        if (!dateKey) {
          continue;
        }

        const dateObj = dateFromKey(dateKey);
        if (!dateObj) {
          continue;
        }

        personPlannedVisits += 1;
        plannedVisits += 1;

        const weekKey = report.weekKey || normalizeDateKey(report.weekStartDateUtc ? formatDateKey(new Date(report.weekStartDateUtc)) : '');
        if (weekKey) {
          activeWeeks.add(weekKey);
        }

        const actualRow = actualByDate.get(dateKey) || {
          visited: '',
          enquiriesReceived: 0,
          shipmentsConverted: 0,
        };

        if (actualRow.visited === 'yes') {
          personActualVisits += 1;
          actualVisits += 1;
        }

        personEnquiries += actualRow.enquiriesReceived;
        personShipments += actualRow.shipmentsConverted;
        totalEnquiries += actualRow.enquiriesReceived;
        totalShipments += actualRow.shipmentsConverted;

        const contactType = normalizeContactType(row.contactType);
        if (contactType) {
          contactDistribution.get(contactType).count += 1;
          visitTypeConversion.get(contactType).enquiries += actualRow.enquiriesReceived;
          visitTypeConversion.get(contactType).shipments += actualRow.shipmentsConverted;
        }

        const segment = normalizeCustomerSegment(row.customerType);
        if (segment) {
          customerConversion.get(segment).enquiries += actualRow.enquiriesReceived;
          customerConversion.get(segment).shipments += actualRow.shipmentsConverted;
        }

        const weekday = getWeekday(dateKey);
        if (weekdayProductivity.has(weekday)) {
          weekdayProductivity.get(weekday).enquiries += actualRow.enquiriesReceived;
          weekdayProductivity.get(weekday).shipments += actualRow.shipmentsConverted;
        }

        const location = String(row.locationArea || '').trim() || 'Unspecified';
        if (!locationProductivity.has(location)) {
          locationProductivity.set(location, {
            location,
            plannedVisits: 0,
            actualVisits: 0,
            enquiries: 0,
            shipments: 0,
          });
        }

        const locationEntry = locationProductivity.get(location);
        locationEntry.plannedVisits += 1;
        if (actualRow.visited === 'yes') {
          locationEntry.actualVisits += 1;
        }
        locationEntry.enquiries += actualRow.enquiriesReceived;
        locationEntry.shipments += actualRow.shipmentsConverted;

        const customer = String(row.customerName || '').trim() || 'Unspecified';
        if (!customerProductivity.has(customer)) {
          customerProductivity.set(customer, {
            customer,
            plannedVisits: 0,
            actualVisits: 0,
            enquiries: 0,
            shipments: 0,
          });
        }

        const customerEntry = customerProductivity.get(customer);
        customerEntry.plannedVisits += 1;
        if (actualRow.visited === 'yes') {
          customerEntry.actualVisits += 1;
        }
        customerEntry.enquiries += actualRow.enquiriesReceived;
        customerEntry.shipments += actualRow.shipmentsConverted;

        const customerName = String(row.customerName || '').trim().toLowerCase();
        if (customerName) {
          const journeyKey = `${salesperson.id}::${customerName}`;
          if (!customerJourneyRows.has(journeyKey)) {
            customerJourneyRows.set(journeyKey, []);
          }

          customerJourneyRows.get(journeyKey).push({
            dateKey,
            dateValue: dateObj.getTime(),
            enquiries: actualRow.enquiriesReceived,
            shipments: actualRow.shipmentsConverted,
          });
        }
      }
    }

    for (const rowSet of customerJourneyRows.values()) {
      const sorted = rowSet.slice().sort((a, b) => a.dateValue - b.dateValue);
      const firstEnquiry = sorted.find((row) => row.enquiries > 0);

      if (!firstEnquiry) {
        continue;
      }

      const laterShipment = sorted.find(
        (row) => row.shipments > 0 && row.dateValue > firstEnquiry.dateValue
      );

      if (!laterShipment) {
        continue;
      }

      const lagDays = Math.round((laterShipment.dateValue - firstEnquiry.dateValue) / MILLISECONDS_PER_DAY);
      if (lagDays >= 0) {
        lagSamples.push(lagDays);
      }
    }

    const weeksCount = activeWeeks.size;
    const avgVisitsPerWeek = roundNumber(safeDivide(personActualVisits, weeksCount));

    return {
      ...salesperson,
      plannedVisits: personPlannedVisits,
      actualVisits: personActualVisits,
      activeWeeks: weeksCount,
      averageVisitsPerWeek: avgVisitsPerWeek,
      enquiries: personEnquiries,
      shipments: personShipments,
      completionRate: roundNumber(safeDivide(personActualVisits, personPlannedVisits)),
      conversionRate: roundNumber(safeDivide(personShipments, personEnquiries)),
    };
  });

  const contactTypeTotal = CONTACT_TYPES.reduce((sum, type) => sum + contactDistribution.get(type).count, 0);

  const mostProductiveDayEntry = WEEKDAY_ORDER.map((day) => ({
    day,
    enquiries: weekdayProductivity.get(day).enquiries,
    shipments: weekdayProductivity.get(day).shipments,
  }))
    .sort((a, b) => {
      if (b.shipments !== a.shipments) {
        return b.shipments - a.shipments;
      }
      return b.enquiries - a.enquiries;
    })[0] || { day: null, enquiries: 0, shipments: 0 };

  const averageLag =
    lagSamples.length > 0
      ? roundNumber(lagSamples.reduce((sum, value) => sum + value, 0) / lagSamples.length)
      : null;

  if (averageLag === null) {
    notes.push('Average enquiry-to-shipment time is null because no matched enquiry-then-shipment customer journeys were found.');
  }

  const salespeopleWithActivity = salespersonProductivity.filter((row) => row.activeWeeks > 0).length;

  return {
    range: {
      from: range.fromWeek.startDate,
      to: range.toWeek.endDate,
      fromWeek: range.fromWeek.isoWeek,
      toWeek: range.toWeek.isoWeek,
      timezone: range.timezone,
      weeks: range.weeks,
    },
    totals: {
      salespeople: salespeople.length,
      plannedVisits,
      actualVisits,
      enquiries: totalEnquiries,
      shipments: totalShipments,
    },
    kpis: {
      visitCompletionRate: {
        value: roundNumber(safeDivide(actualVisits, plannedVisits)),
        numerator: actualVisits,
        denominator: plannedVisits,
      },
      enquiryToShipmentConversionRate: {
        value: roundNumber(safeDivide(totalShipments, totalEnquiries)),
        numerator: totalShipments,
        denominator: totalEnquiries,
      },
      averageVisitsPerWeekPerSalesperson: {
        value: roundNumber(
          safeDivide(
            salespersonProductivity.reduce((sum, row) => sum + row.averageVisitsPerWeek, 0),
            salespeopleWithActivity || salespeople.length
          )
        ),
        salespeopleWithActivity,
      },
      enquiriesPerVisit: {
        value: roundNumber(safeDivide(totalEnquiries, actualVisits)),
        numerator: totalEnquiries,
        denominator: actualVisits,
      },
      shipmentsPerVisit: {
        value: roundNumber(safeDivide(totalShipments, actualVisits)),
        numerator: totalShipments,
        denominator: actualVisits,
      },
      mostProductiveDay: mostProductiveDayEntry,
      averageDaysEnquiryToShipment: averageLag,
      averageDaysEnquiryToShipmentSamples: lagSamples.length,
    },
    charts: {
      actualVsPlannedBySalesperson: salespersonProductivity
        .map((row) => ({
          salesperson: row.name || row.email,
          plannedVisits: row.plannedVisits,
          actualVisits: row.actualVisits,
          averageVisitsPerWeek: row.averageVisitsPerWeek,
        }))
        .sort((a, b) => b.actualVisits - a.actualVisits),
      contactTypeDistribution: CONTACT_TYPES.map((type) => ({
        type: type.toUpperCase(),
        count: contactDistribution.get(type).count,
        percentage: roundNumber(safeDivide(contactDistribution.get(type).count, contactTypeTotal)),
      })),
      conversionByCustomerType: CUSTOMER_SEGMENTS.map((segment) => {
        const bucket = customerConversion.get(segment);
        return {
          customerType: segment === 'new' ? 'New' : 'Existing',
          enquiries: bucket.enquiries,
          shipments: bucket.shipments,
          conversionRate: roundNumber(safeDivide(bucket.shipments, bucket.enquiries)),
        };
      }),
      conversionByVisitType: CONTACT_TYPES.map((type) => {
        const bucket = visitTypeConversion.get(type);
        return {
          visitType: type.toUpperCase(),
          enquiries: bucket.enquiries,
          shipments: bucket.shipments,
          conversionRate: roundNumber(safeDivide(bucket.shipments, bucket.enquiries)),
        };
      }),
      productivityByWeekday: WEEKDAY_ORDER.map((day) => ({
        day,
        enquiries: weekdayProductivity.get(day).enquiries,
        shipments: weekdayProductivity.get(day).shipments,
      })),
    },
    tables: {
      salespersonProductivity: salespersonProductivity.sort((a, b) => {
        if (b.actualVisits !== a.actualVisits) {
          return b.actualVisits - a.actualVisits;
        }
        return b.shipments - a.shipments;
      }),
      locationProductivity: Array.from(locationProductivity.values())
        .map((row) => ({
          ...row,
          completionRate: roundNumber(safeDivide(row.actualVisits, row.plannedVisits)),
          conversionRate: roundNumber(safeDivide(row.shipments, row.enquiries)),
        }))
        .sort((a, b) => {
          if (b.actualVisits !== a.actualVisits) {
            return b.actualVisits - a.actualVisits;
          }
          return b.shipments - a.shipments;
        }),
      customerProductivity: Array.from(customerProductivity.values())
        .map((row) => ({
          ...row,
          completionRate: roundNumber(safeDivide(row.actualVisits, row.plannedVisits)),
          conversionRate: roundNumber(safeDivide(row.shipments, row.enquiries)),
        }))
        .sort((a, b) => {
          if (b.actualVisits !== a.actualVisits) {
            return b.actualVisits - a.actualVisits;
          }
          return b.shipments - a.shipments;
        }),
    },
    notes,
  };
}

module.exports = {
  safeDivide,
  resolveInsightsRange,
  buildInsightsPayload,
};
