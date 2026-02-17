const { IST_TIME_ZONE, formatDateKey, resolveWeekFromQuery, getIsoWeekStringFromDate } = require('./week');

const MAX_RANGE_DAYS = 370;

function roundNumber(value, precision = 4) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function safeDivide(numerator, denominator) {
  if (!denominator) {
    return 0;
  }
  return numerator / denominator;
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

function resolveStage3Range(query = {}) {
  const rawWeek = String(query.week || '').trim();
  const rawMonth = String(query.month || '').trim();

  if (rawWeek) {
    const week = resolveWeekFromQuery(rawWeek);
    if (!week) {
      return { error: 'Invalid week query' };
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
      return { error: 'Invalid month query' };
    }
    return {
      ...monthRange,
      timezone: IST_TIME_ZONE,
    };
  }

  const fromInput = String(query.from || '').trim();
  const toInput = String(query.to || '').trim();
  const defaultToWeek = resolveWeekFromQuery('');
  const toDate = normalizeDateKey(toInput) || (toInput ? resolveWeekFromQuery(toInput)?.endDate : defaultToWeek.endDate);
  const fromDate = normalizeDateKey(fromInput) || (fromInput ? resolveWeekFromQuery(fromInput)?.startDate : formatDateKey(addDays(dateFromKey(toDate), -83)));

  if (!toDate || !fromDate) {
    return { error: 'Invalid date range' };
  }

  const rangeDays = Math.floor((dateFromKey(toDate) - dateFromKey(fromDate)) / 86400000) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: `Range exceeds ${MAX_RANGE_DAYS} days` };
  }

  return {
    fromDate,
    toDate,
    mode: 'range',
    label: `${fromDate}..${toDate}`,
    timezone: IST_TIME_ZONE,
  };
}

function hasMeaningfulPlanningRow(row) {
  if (!row || typeof row !== 'object') {
    return false;
  }
  return [
    String(row.customerName || '').trim(),
    String(row.contactType || '').trim(),
    String(row.locationArea || '').trim(),
  ].some(Boolean);
}

function normalizeCustomerName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildStage3Payload({ users, reports, range, filters }) {
  const fromDate = normalizeDateKey(range.fromDate);
  const toDate = normalizeDateKey(range.toDate);
  const fromValue = dateFromKey(fromDate)?.getTime();
  const toValue = dateFromKey(toDate)?.getTime();

  const filterSalesmen = new Set((filters.salesmen || []).map(String));
  const filterCategory = String(filters.reasonCategory || '').trim().toLowerCase();
  const filterCustomer = normalizeCustomerName(filters.customer);
  const filterMainTeam = String(filters.mainTeam || '').trim();
  const filterTeam = String(filters.team || '').trim();
  const filterSubTeam = String(filters.subTeam || '').trim();

  const usersById = new Map();
  const salesmenOptions = [];
  const mainTeams = new Set();
  const teams = new Set();
  const subTeams = new Set();

  for (const user of users || []) {
    const id = String(user._id);
    const normalizedUser = {
      id,
      name: user.name || '',
      email: user.email || '',
      mainTeam: String(user.mainTeam || 'Unassigned').trim(),
      team: String(user.team || 'Unassigned').trim(),
      subTeam: String(user.subTeam || 'Unassigned').trim(),
    };
    usersById.set(id, normalizedUser);
    salesmenOptions.push({ id, name: normalizedUser.name || normalizedUser.email });
    mainTeams.add(normalizedUser.mainTeam);
    teams.add(normalizedUser.team);
    subTeams.add(normalizedUser.subTeam);
  }

  let plannedVisitsTotal = 0;
  let nonVisitedCountTotal = 0;

  const weeklyTrendMap = new Map();
  const reasonDistributionMap = new Map();
  const salespersonRatesMap = new Map();
  const drilldownRows = [];

  // For recurrence detection
  // Key: salesmanId|normalizedCustomerName
  // Value: { lastDate, weeks: Set, reasonCounts: Map, totalCount, salesmanName, customerName }
  const customerHistoryMap = new Map();

  // Helper to get window start for recurrence (8 weeks before range start)
  const windowStartValue = fromValue - 8 * 7 * 24 * 60 * 60 * 1000;

  for (const report of reports || []) {
    const salesmanId = String(report.salesmanId);
    if (!usersById.has(salesmanId)) continue;
    const user = usersById.get(salesmanId);

    // Apply User Filters
    if (filterSalesmen.size > 0 && !filterSalesmen.has(salesmanId)) continue;
    if (filterMainTeam && user.mainTeam !== filterMainTeam) continue;
    if (filterTeam && user.team !== filterTeam) continue;
    if (filterSubTeam && user.subTeam !== filterSubTeam) continue;

    const actualMap = new Map();
    for (const row of report.actualOutputRows || []) {
      const d = normalizeDateKey(row.date);
      if (d) actualMap.set(d, row);
    }

    for (const planningRow of report.planningRows || []) {
      if (!hasMeaningfulPlanningRow(planningRow)) continue;

      const dateKey = normalizeDateKey(planningRow.date);
      if (!dateKey) continue;
      const dateValue = dateFromKey(dateKey)?.getTime();
      
      // We need data if it falls in range OR if it's within 8 weeks before range (for recurrence)
      const inRange = dateValue >= fromValue && dateValue <= toValue;
      const inRecurrenceWindow = dateValue >= windowStartValue && dateValue <= toValue;

      if (!inRecurrenceWindow) continue;

      const actualRow = actualMap.get(dateKey);
      const isNonVisit = actualRow?.visited === 'no';
      const category = String(actualRow?.notVisitedReasonCategory || '').trim() || 'uncategorized';
      const normCust = normalizeCustomerName(planningRow.customerName);

      if (inRange) {
        plannedVisitsTotal++;
        if (isNonVisit) {
          nonVisitedCountTotal++;
        }
      }

      // Recurrence tracking (qualifying non-visits)
      if (isNonVisit && normCust) {
        const historyKey = `${salesmanId}|${normCust}`;
        if (!customerHistoryMap.has(historyKey)) {
          customerHistoryMap.set(historyKey, {
            salesmanId,
            salesmanName: user.name || user.email,
            customerName: String(planningRow.customerName).trim(),
            normCust,
            lastDate: dateKey,
            weeks: new Set(),
            reasonCounts: new Map(),
            totalCount: 0,
          });
        }
        const hist = customerHistoryMap.get(historyKey);
        hist.totalCount++;
        hist.weeks.add(report.weekKey); // Distinct weeks for count
        hist.reasonCounts.set(category, (hist.reasonCounts.get(category) || 0) + 1);
        if (dateKey > hist.lastDate) {
          hist.lastDate = dateKey;
        }
      }

      // Aggregate in-range stats with filters
      if (inRange) {
        // Apply Row Filters
        if (filterCategory && category !== filterCategory) continue;
        if (filterCustomer && !normCust.includes(filterCustomer)) continue;

        const isoWeek = getIsoWeekStringFromDate(dateFromKey(dateKey));
        
        // Weekly Trend
        if (!weeklyTrendMap.has(isoWeek)) {
          weeklyTrendMap.set(isoWeek, { planned: 0, nonVisited: 0 });
        }
        const wt = weeklyTrendMap.get(isoWeek);
        wt.planned++;
        if (isNonVisit) wt.nonVisited++;

        // Reason Distribution
        if (isNonVisit) {
          reasonDistributionMap.set(category, (reasonDistributionMap.get(category) || 0) + 1);
        }

        // Salesperson Rates
        if (!salespersonRatesMap.has(salesmanId)) {
          salespersonRatesMap.set(salesmanId, { 
            id: salesmanId, 
            name: user.name || user.email, 
            planned: 0, 
            nonVisited: 0 
          });
        }
        const sr = salespersonRatesMap.get(salesmanId);
        sr.planned++;
        if (isNonVisit) sr.nonVisited++;

        // Drilldown Rows
        drilldownRows.push({
          date: dateKey,
          isoWeek,
          salesmanName: user.name || user.email,
          customerName: String(planningRow.customerName).trim(),
          locationArea: String(planningRow.locationArea).trim(),
          category,
          reason: String(actualRow?.notVisitedReason || '').trim() || '-',
          visited: actualRow?.visited || 'no_entry'
        });
      }
    }
  }

  // Finalize Recurrence List
  const topRepeatedCustomers = [];
  for (const hist of customerHistoryMap.values()) {
    // Threshold: >= 2 distinct weeks in the LAST 8 WEEKS context (relative to range)
    if (hist.weeks.size >= 2) {
      let dominantReason = 'uncategorized';
      let maxCount = -1;
      for (const [cat, count] of hist.reasonCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          dominantReason = cat;
        }
      }

      topRepeatedCustomers.push({
        salesmanId: hist.salesmanId,
        salesmanName: hist.salesmanName,
        customerName: hist.customerName,
        occurrences8w: hist.weeks.size,
        totalHits: hist.totalCount,
        lastNonVisitDate: hist.lastDate,
        dominantReasonCategory: dominantReason
      });
    }
  }
  topRepeatedCustomers.sort((a, b) => b.occurrences8w - a.occurrences8w || b.lastNonVisitDate.localeCompare(a.lastNonVisitDate));

  return {
    range: {
      from: fromDate,
      to: toDate,
      mode: range.mode,
      label: range.label,
      timezone: range.timezone
    },
    filtersApplied: {
      salesmen: Array.from(filterSalesmen),
      reasonCategory: filters.reasonCategory || null,
      customer: filters.customer || null,
      mainTeam: filters.mainTeam || null,
      team: filters.team || null,
      subTeam: filters.subTeam || null
    },
    totals: {
      plannedVisits: plannedVisitsTotal,
      plannedButNotVisitedCount: nonVisitedCountTotal,
      nonVisitRate: roundNumber(safeDivide(nonVisitedCountTotal, plannedVisitsTotal))
    },
    weeklyTrend: Array.from(weeklyTrendMap.entries())
      .map(([isoWeek, data]) => ({
        isoWeek,
        plannedButNotVisitedCount: data.nonVisited,
        nonVisitRate: roundNumber(safeDivide(data.nonVisited, data.planned))
      }))
      .sort((a, b) => a.isoWeek.localeCompare(b.isoWeek)),
    reasonDistribution: Array.from(reasonDistributionMap.entries())
      .map(([reasonCategory, count]) => ({ reasonCategory, count }))
      .sort((a, b) => b.count - a.count),
    salespersonRates: Array.from(salespersonRatesMap.values())
      .map(sr => ({
        id: sr.id,
        name: sr.name,
        plannedVisits: sr.planned,
        nonVisitedCount: sr.nonVisited,
        nonVisitRate: roundNumber(safeDivide(sr.nonVisited, sr.planned))
      }))
      .sort((a, b) => b.nonVisitRate - a.nonVisitRate || b.nonVisitedCount - a.nonVisitedCount),
    topRepeatedCustomers: topRepeatedCustomers.slice(0, 50),
    drilldownRows: drilldownRows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100),
    filterOptions: {
      salesmen: salesmenOptions.sort((a, b) => a.name.localeCompare(b.name)),
      mainTeam: Array.from(mainTeams).sort(),
      team: Array.from(teams).sort(),
      subTeam: Array.from(subTeams).sort(),
      reasonCategories: ['client_unavailable', 'no_response', 'internal_engagement', 'travel_logistics_issue', 'uncategorized']
    }
  };
}

module.exports = {
  resolveStage3Range,
  buildStage3Payload
};
