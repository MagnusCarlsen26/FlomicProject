const { IST_TIME_ZONE, formatDateKey, resolveWeekFromQuery } = require('./week');

const VALID_CONTACT_TYPES = new Set(['nc', 'fc', 'jsv', 'sc']);
const VALID_CUSTOMER_TYPES = new Set(['targeted_budgeted', 'existing']);
const MAX_RANGE_DAYS = 370;

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

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  if (formatDateKey(parsed) !== trimmed) {
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

function getIsoWeekString(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function resolveMonthQuery(monthQuery) {
  if (typeof monthQuery !== 'string' || !monthQuery.trim()) {
    return null;
  }

  const trimmed = monthQuery.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  const end = addDays(nextMonth, -1);

  return {
    fromDate: formatDateKey(start),
    toDate: formatDateKey(end),
    mode: 'month',
    label: trimmed,
  };
}

function resolveStage1Range(query = {}) {
  const rawWeek = String(query.week || '').trim();
  const rawMonth = String(query.month || '').trim();

  if (rawWeek) {
    const week = resolveWeekFromQuery(rawWeek);
    if (!week) {
      return { error: 'Invalid week query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD' };
    }
    return {
      fromDate: week.startDate,
      toDate: week.endDate,
      mode: 'week',
      label: week.isoWeek,
      timezone: IST_TIME_ZONE,
    };
  }

  if (rawMonth) {
    const monthRange = resolveMonthQuery(rawMonth);
    if (!monthRange) {
      return { error: 'Invalid month query. Use YYYY-MM (example: 2026-02)' };
    }
    return {
      ...monthRange,
      timezone: IST_TIME_ZONE,
    };
  }

  const fromInput = String(query.from || '').trim();
  const toInput = String(query.to || '').trim();
  const defaultToWeek = resolveWeekFromQuery('');
  const toAsDate = normalizeDateKey(toInput);
  const fromAsDate = normalizeDateKey(fromInput);
  const toDate = toAsDate || (toInput ? resolveWeekFromQuery(toInput)?.endDate : defaultToWeek.endDate);
  const fromDate =
    fromAsDate ||
    (fromInput
      ? resolveWeekFromQuery(fromInput)?.startDate
      : formatDateKey(addDays(dateFromKey(toDate), -83)));

  if (!toDate) {
    return { error: 'Invalid to query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD' };
  }
  if (!fromDate) {
    return { error: 'Invalid from query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD' };
  }

  if (dateFromKey(fromDate) > dateFromKey(toDate)) {
    return { error: 'Invalid range: from must be less than or equal to to' };
  }

  const rangeDays = Math.floor((dateFromKey(toDate) - dateFromKey(fromDate)) / 86400000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: `Invalid range: maximum supported range is ${MAX_RANGE_DAYS} days` };
  }

  return {
    fromDate,
    toDate,
    mode: 'range',
    label: `${fromDate}..${toDate}`,
    timezone: IST_TIME_ZONE,
  };
}

function normalizeContactType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }
  return VALID_CONTACT_TYPES.has(normalized) ? normalized : 'unknown';
}

function normalizeCustomerType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_CUSTOMER_TYPES.has(normalized) ? normalized : '';
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

function buildActualByDate(actualRows) {
  const map = new Map();
  for (const row of actualRows || []) {
    const date = normalizeDateKey(row?.date);
    if (!date) {
      continue;
    }
    map.set(date, String(row?.visited || '').trim().toLowerCase() === 'yes');
  }
  return map;
}

function createMetricAccumulator() {
  return { plannedVisits: 0, actualVisits: 0 };
}

function finalizeMetrics(metrics) {
  const plannedVisits = metrics.plannedVisits;
  const actualVisits = metrics.actualVisits;
  return {
    plannedVisits,
    actualVisits,
    variance: plannedVisits - actualVisits,
    achievementRate: roundNumber(safeDivide(actualVisits, plannedVisits)),
  };
}

function addCount(target, visited) {
  target.plannedVisits += 1;
  if (visited) {
    target.actualVisits += 1;
  }
}

function buildStage1Payload({ users, reports, range, filters }) {
  const fromDate = normalizeDateKey(range.fromDate);
  const toDate = normalizeDateKey(range.toDate);
  const fromValue = dateFromKey(fromDate)?.getTime();
  const toValue = dateFromKey(toDate)?.getTime();

  const normalizedSalesmenIds = new Set((filters.salesmen || []).map((id) => String(id)));
  const filterCallType = filters.callType || '';
  const filterCustomerType = filters.customerType || '';
  const filterMainTeam = filters.mainTeam || '';
  const filterTeam = filters.team || '';
  const filterSubTeam = filters.subTeam || '';

  const usersById = new Map();
  const salesmenOptions = [];
  const mainTeamSet = new Set();
  const teamSet = new Set();
  const subTeamSet = new Set();

  for (const user of users || []) {
    const id = String(user._id);
    const normalizedUser = {
      id,
      name: user.name || '',
      email: user.email || '',
      mainTeam: String(user.mainTeam || 'Unassigned').trim() || 'Unassigned',
      team: String(user.team || 'Unassigned').trim() || 'Unassigned',
      subTeam: String(user.subTeam || 'Unassigned').trim() || 'Unassigned',
    };
    usersById.set(id, normalizedUser);
    salesmenOptions.push({ id, name: normalizedUser.name || normalizedUser.email });
    mainTeamSet.add(normalizedUser.mainTeam);
    teamSet.add(normalizedUser.team);
    subTeamSet.add(normalizedUser.subTeam);
  }

  const totals = createMetricAccumulator();
  const daily = new Map();
  const weekly = new Map();
  const monthly = new Map();
  const callTypeSummary = new Map([
    ['nc', createMetricAccumulator()],
    ['fc', createMetricAccumulator()],
    ['jsv', createMetricAccumulator()],
    ['sc', createMetricAccumulator()],
    ['unknown', createMetricAccumulator()],
  ]);
  const customerTypeSummary = new Map([
    ['targeted_budgeted', createMetricAccumulator()],
    ['existing', createMetricAccumulator()],
    ['unknown', createMetricAccumulator()],
  ]);
  const salesperson = new Map();
  const mainTeamRollup = new Map();
  const teamRollup = new Map();
  const subTeamRollup = new Map();
  const drilldownRows = [];

  for (const report of reports || []) {
    const salesmanId = String(report.salesmanId);
    const user = usersById.get(salesmanId);
    if (!user) {
      continue;
    }

    if (normalizedSalesmenIds.size > 0 && !normalizedSalesmenIds.has(salesmanId)) {
      continue;
    }
    if (filterMainTeam && user.mainTeam !== filterMainTeam) {
      continue;
    }
    if (filterTeam && user.team !== filterTeam) {
      continue;
    }
    if (filterSubTeam && user.subTeam !== filterSubTeam) {
      continue;
    }

    const actualByDate = buildActualByDate(report.actualOutputRows);

    for (const planningRow of report.planningRows || []) {
      if (!hasMeaningfulPlanningRow(planningRow)) {
        continue;
      }

      const dateKey = normalizeDateKey(planningRow.date);
      if (!dateKey) {
        continue;
      }
      const dateValue = dateFromKey(dateKey)?.getTime();
      if (!Number.isFinite(dateValue) || dateValue < fromValue || dateValue > toValue) {
        continue;
      }

      const rowCallType = normalizeContactType(planningRow.contactType);
      const rowCustomerType = normalizeCustomerType(planningRow.customerType) || 'unknown';
      if (filterCallType && rowCallType !== filterCallType) {
        continue;
      }
      if (filterCustomerType && rowCustomerType !== filterCustomerType) {
        continue;
      }

      const isVisited = actualByDate.get(dateKey) === true;
      const isoWeek = getIsoWeekString(dateFromKey(dateKey));
      const monthKey = dateKey.slice(0, 7);

      if (!daily.has(dateKey)) {
        daily.set(dateKey, createMetricAccumulator());
      }
      if (!weekly.has(isoWeek)) {
        weekly.set(isoWeek, createMetricAccumulator());
      }
      if (!monthly.has(monthKey)) {
        monthly.set(monthKey, createMetricAccumulator());
      }
      if (!salesperson.has(user.id)) {
        salesperson.set(user.id, {
          salesman: {
            id: user.id,
            name: user.name,
            email: user.email,
            mainTeam: user.mainTeam,
            team: user.team,
            subTeam: user.subTeam,
          },
          ...createMetricAccumulator(),
        });
      }
      if (!mainTeamRollup.has(user.mainTeam)) {
        mainTeamRollup.set(user.mainTeam, { label: user.mainTeam, ...createMetricAccumulator() });
      }
      if (!teamRollup.has(user.team)) {
        teamRollup.set(user.team, { label: user.team, ...createMetricAccumulator() });
      }
      if (!subTeamRollup.has(user.subTeam)) {
        subTeamRollup.set(user.subTeam, { label: user.subTeam, ...createMetricAccumulator() });
      }

      addCount(totals, isVisited);
      addCount(daily.get(dateKey), isVisited);
      addCount(weekly.get(isoWeek), isVisited);
      addCount(monthly.get(monthKey), isVisited);
      addCount(callTypeSummary.get(rowCallType), isVisited);
      addCount(customerTypeSummary.get(rowCustomerType), isVisited);
      addCount(salesperson.get(user.id), isVisited);
      addCount(mainTeamRollup.get(user.mainTeam), isVisited);
      addCount(teamRollup.get(user.team), isVisited);
      addCount(subTeamRollup.get(user.subTeam), isVisited);

      drilldownRows.push({
        date: dateKey,
        isoWeek,
        month: monthKey,
        callType: rowCallType,
        customerType: rowCustomerType,
        visited: isVisited,
        customerName: String(planningRow.customerName || '').trim(),
        locationArea: String(planningRow.locationArea || '').trim(),
        salesman: {
          id: user.id,
          name: user.name,
          email: user.email,
          mainTeam: user.mainTeam,
          team: user.team,
          subTeam: user.subTeam,
        },
      });
    }
  }

  const salespersonRows = Array.from(salesperson.values()).map((row) => ({
    ...row.salesman,
    ...finalizeMetrics(row),
  }));

  const eligibleRankingRows = salespersonRows.filter((row) => row.plannedVisits >= 3);
  const sortByAchievementDesc = (a, b) => {
    if (b.achievementRate !== a.achievementRate) {
      return b.achievementRate - a.achievementRate;
    }
    return b.plannedVisits - a.plannedVisits;
  };
  const sortByAchievementAsc = (a, b) => {
    if (a.achievementRate !== b.achievementRate) {
      return a.achievementRate - b.achievementRate;
    }
    return b.plannedVisits - a.plannedVisits;
  };

  return {
    range: {
      from: fromDate,
      to: toDate,
      mode: range.mode,
      label: range.label,
      timezone: range.timezone || IST_TIME_ZONE,
    },
    filtersApplied: {
      salesmen: filters.salesmen || [],
      callType: filterCallType || null,
      customerType: filterCustomerType || null,
      mainTeam: filterMainTeam || null,
      team: filterTeam || null,
      subTeam: filterSubTeam || null,
    },
    totals: finalizeMetrics(totals),
    dailyTrend: Array.from(daily.entries())
      .map(([date, metric]) => ({ date, ...finalizeMetrics(metric) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    weeklySummary: Array.from(weekly.entries())
      .map(([isoWeek, metric]) => ({ isoWeek, ...finalizeMetrics(metric) }))
      .sort((a, b) => a.isoWeek.localeCompare(b.isoWeek)),
    monthlyRollup: Array.from(monthly.entries())
      .map(([month, metric]) => ({ month, ...finalizeMetrics(metric) }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    hierarchyRollups: {
      salesperson: salespersonRows.sort((a, b) => b.actualVisits - a.actualVisits),
      mainTeam: Array.from(mainTeamRollup.values())
        .map((row) => ({ label: row.label, ...finalizeMetrics(row) }))
        .sort((a, b) => b.actualVisits - a.actualVisits),
      team: Array.from(teamRollup.values())
        .map((row) => ({ label: row.label, ...finalizeMetrics(row) }))
        .sort((a, b) => b.actualVisits - a.actualVisits),
      subTeam: Array.from(subTeamRollup.values())
        .map((row) => ({ label: row.label, ...finalizeMetrics(row) }))
        .sort((a, b) => b.actualVisits - a.actualVisits),
    },
    breakdowns: {
      callType: Array.from(callTypeSummary.entries()).map(([callType, metric]) => ({
        callType,
        ...finalizeMetrics(metric),
      })),
      customerType: Array.from(customerTypeSummary.entries()).map(([customerType, metric]) => ({
        customerType,
        ...finalizeMetrics(metric),
      })),
    },
    topPerformers: {
      overAchievers: eligibleRankingRows.slice().sort(sortByAchievementDesc).slice(0, 5),
      underAchievers: eligibleRankingRows.slice().sort(sortByAchievementAsc).slice(0, 5),
      minimumPlannedVisits: 3,
    },
    drilldownRows: drilldownRows.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return (a.salesman.name || a.salesman.email).localeCompare(b.salesman.name || b.salesman.email);
    }),
    filterOptions: {
      salesmen: salesmenOptions.sort((a, b) => a.name.localeCompare(b.name)),
      mainTeam: Array.from(mainTeamSet).sort((a, b) => a.localeCompare(b)),
      team: Array.from(teamSet).sort((a, b) => a.localeCompare(b)),
      subTeam: Array.from(subTeamSet).sort((a, b) => a.localeCompare(b)),
      callType: ['nc', 'fc', 'jsv', 'sc', 'unknown'],
      customerType: ['targeted_budgeted', 'existing'],
    },
  };
}

module.exports = {
  resolveStage1Range,
  buildStage1Payload,
};
