const { formatDateKey, getIsoWeekStringFromDate } = require('./week');

const CUSTOMER_TYPES = new Set(['', 'targeted_budgeted', 'existing']);
const CONTACT_TYPES = new Set(['', 'nc', 'fc', 'sc', 'jsv']);
const VISITED_VALUES = new Set(['', 'yes', 'no']);

function parseIsoWeekNumber(isoWeekString) {
  const match = /^\d{4}-W(\d{2})$/.exec(String(isoWeekString || ''));
  if (!match) {
    return 1;
  }

  return Number(match[1]);
}

function buildDefaultPlanningRow(date) {
  return {
    date,
    isoWeek: parseIsoWeekNumber(getIsoWeekStringFromDate(new Date(`${date}T00:00:00.000Z`))),
    customerName: '',
    locationArea: '',
    customerType: '',
    contactType: '',
    jsvWithWhom: '',
  };
}

function buildDefaultActualOutputRow(date) {
  return {
    date,
    isoWeek: parseIsoWeekNumber(getIsoWeekStringFromDate(new Date(`${date}T00:00:00.000Z`))),
    visited: '',
    notVisitedReason: '',
    notVisitedReasonCategory: '',
    enquiriesReceived: 0,
    shipmentsConverted: 0,
  };
}

function buildWeekDates(week) {
  const dates = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const nextDate = new Date(week.weekStartDateUtc);
    nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
    dates.push(formatDateKey(nextDate));
  }

  return dates;
}

function buildDefaultPlanningRows(week) {
  return buildWeekDates(week).map(buildDefaultPlanningRow);
}

function buildDefaultActualOutputRows(week) {
  return buildWeekDates(week).map(buildDefaultActualOutputRow);
}

function validateRowsEnvelope(rows, label) {
  if (!Array.isArray(rows)) {
    return `${label} must be an array of exactly 7 rows`;
  }

  if (rows.length !== 7) {
    return `${label} must contain exactly 7 rows`;
  }

  return null;
}

function parseNonNegativeInteger(rawValue, label) {
  if (rawValue === '' || rawValue === null || rawValue === undefined) {
    return { value: 0 };
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0) {
    return { error: `${label} must be a non-negative integer` };
  }

  return { value };
}

function normalizePlanningRows(rows, week, options = {}) {
  const {
    allowedAdminIds = null,
    existingRowsByDate = null,
    allowLegacyUnchanged = false,
  } = options;
  const envelopeError = validateRowsEnvelope(rows, 'planning.rows');
  if (envelopeError) {
    return { error: envelopeError };
  }

  const defaults = buildDefaultPlanningRows(week);
  const dateSet = new Set(defaults.map((row) => row.date));
  const normalizedByDate = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const input = rows[index];
    if (!input || typeof input !== 'object') {
      return { error: `planning.rows[${index}] must be an object` };
    }

    const date = String(input.date || '');
    if (!dateSet.has(date)) {
      return { error: `planning.rows[${index}].date must be a valid current-week date` };
    }

    if (normalizedByDate.has(date)) {
      return { error: `planning.rows has duplicate date ${date}` };
    }

    const customerType = String(input.customerType || '').trim().toLowerCase();
    if (!CUSTOMER_TYPES.has(customerType)) {
      return {
        error:
          'planning.rows customerType must be one of: targeted_budgeted, existing, or blank',
      };
    }

    const contactType = String(input.contactType || '').trim().toLowerCase();
    if (!CONTACT_TYPES.has(contactType)) {
      return { error: 'planning.rows contactType must be one of: nc, fc, sc, jsv, or blank' };
    }

    const normalizedRow = {
      date,
      isoWeek: parseIsoWeekNumber(getIsoWeekStringFromDate(new Date(`${date}T00:00:00.000Z`))),
      customerName: String(input.customerName || '').trim().slice(0, 200),
      locationArea: String(input.locationArea || '').trim().slice(0, 200),
      customerType,
      contactType,
      jsvWithWhom: String(input.jsvWithWhom || '').trim().slice(0, 200),
    };

    if (contactType !== 'jsv') {
      normalizedRow.jsvWithWhom = '';
    } else if (normalizedRow.jsvWithWhom) {
      const isAllowedAdminId =
        allowedAdminIds instanceof Set && allowedAdminIds.has(normalizedRow.jsvWithWhom);

      if (!isAllowedAdminId) {
        const existingRow =
          existingRowsByDate instanceof Map ? existingRowsByDate.get(date) : null;
        const existingValue = String(existingRow?.jsvWithWhom || '').trim();
        const isUnchangedLegacy =
          allowLegacyUnchanged === true &&
          existingValue &&
          existingValue === normalizedRow.jsvWithWhom;

        if (!isUnchangedLegacy) {
          return {
            error: `planning.rows[${index}].jsvWithWhom must reference an admin user`,
          };
        }
      }
    }

    normalizedByDate.set(date, normalizedRow);
  }

  const normalizedRows = defaults.map((defaultRow) => normalizedByDate.get(defaultRow.date) || defaultRow);
  return { rows: normalizedRows };
}

function normalizeActualOutputRows(rows, week, options = {}) {
  const {
    existingRowsByDate = null,
    allowLegacyUnchanged = false,
  } = options;
  const envelopeError = validateRowsEnvelope(rows, 'actualOutput.rows');
  if (envelopeError) {
    return { error: envelopeError };
  }

  const defaults = buildDefaultActualOutputRows(week);
  const dateSet = new Set(defaults.map((row) => row.date));
  const normalizedByDate = new Map();

  const VALID_CATEGORIES = new Set([
    '',
    'client_unavailable',
    'no_response',
    'internal_engagement',
    'travel_logistics_issue',
  ]);

  for (let index = 0; index < rows.length; index += 1) {
    const input = rows[index];
    if (!input || typeof input !== 'object') {
      return { error: `actualOutput.rows[${index}] must be an object` };
    }

    const date = String(input.date || '');
    if (!dateSet.has(date)) {
      return { error: `actualOutput.rows[${index}].date must be a valid current-week date` };
    }

    if (normalizedByDate.has(date)) {
      return { error: `actualOutput.rows has duplicate date ${date}` };
    }

    const visited = String(input.visited || '').trim().toLowerCase();
    if (!VISITED_VALUES.has(visited)) {
      return { error: 'actualOutput.rows visited must be one of: yes, no, or blank' };
    }

    const notVisitedReason = String(input.notVisitedReason || '').trim().slice(0, 1000);
    const notVisitedReasonCategory = String(input.notVisitedReasonCategory || '').trim().toLowerCase();

    if (visited === 'no') {
      if (!notVisitedReason) {
        return { error: `actualOutput.rows[${index}].notVisitedReason is required when visited is no` };
      }

      if (!VALID_CATEGORIES.has(notVisitedReasonCategory)) {
        return { error: `actualOutput.rows[${index}].notVisitedReasonCategory is invalid` };
      }

      if (!notVisitedReasonCategory) {
        // Check for legacy exception
        const existingRow = existingRowsByDate instanceof Map ? existingRowsByDate.get(date) : null;
        const existingCategory = String(existingRow?.notVisitedReasonCategory || '').trim();
        const existingReason = String(existingRow?.notVisitedReason || '').trim();
        const existingVisited = String(existingRow?.visited || '').trim().toLowerCase();

        const isUnchangedLegacy =
          allowLegacyUnchanged === true &&
          existingVisited === 'no' &&
          !existingCategory &&
          existingReason === notVisitedReason;

        if (!isUnchangedLegacy) {
          return { error: `actualOutput.rows[${index}].notVisitedReasonCategory is required when visited is no` };
        }
      }
    }

    const enquiriesResult = parseNonNegativeInteger(input.enquiriesReceived, 'enquiriesReceived');
    if (enquiriesResult.error) {
      return { error: `actualOutput.rows[${index}].${enquiriesResult.error}` };
    }

    const shipmentsResult = parseNonNegativeInteger(input.shipmentsConverted, 'shipmentsConverted');
    if (shipmentsResult.error) {
      return { error: `actualOutput.rows[${index}].${shipmentsResult.error}` };
    }

    const normalizedRow = {
      date,
      isoWeek: parseIsoWeekNumber(getIsoWeekStringFromDate(new Date(`${date}T00:00:00.000Z`))),
      visited,
      notVisitedReason: visited === 'no' ? notVisitedReason : '',
      notVisitedReasonCategory: visited === 'no' ? notVisitedReasonCategory : '',
      enquiriesReceived: enquiriesResult.value,
      shipmentsConverted: shipmentsResult.value,
    };

    normalizedByDate.set(date, normalizedRow);
  }

  const normalizedRows = defaults.map((defaultRow) => normalizedByDate.get(defaultRow.date) || defaultRow);
  return { rows: normalizedRows };
}

function ensureWeekRows(report, week) {
  const defaultPlanningRows = buildDefaultPlanningRows(week);
  const defaultActualRows = buildDefaultActualOutputRows(week);

  const planningResult = normalizePlanningRows(
    Array.isArray(report.planningRows) ? report.planningRows : defaultPlanningRows,
    week
  );
  const actualResult = normalizeActualOutputRows(
    Array.isArray(report.actualOutputRows) ? report.actualOutputRows : defaultActualRows,
    week
  );

  const planningRows = planningResult.rows || defaultPlanningRows;
  const actualOutputRows = actualResult.rows || defaultActualRows;

  const planningChanged = JSON.stringify(report.planningRows || []) !== JSON.stringify(planningRows);
  const actualChanged = JSON.stringify(report.actualOutputRows || []) !== JSON.stringify(actualOutputRows);

  if (planningChanged) {
    report.planningRows = planningRows;
  }

  if (actualChanged) {
    report.actualOutputRows = actualOutputRows;
  }

  return planningChanged || actualChanged;
}

module.exports = {
  buildDefaultActualOutputRows,
  buildDefaultPlanningRows,
  ensureWeekRows,
  normalizeActualOutputRows,
  normalizePlanningRows,
};
