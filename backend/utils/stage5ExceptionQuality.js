const { resolveInsightsRange } = require('./adminInsights');
const { getIsoWeekStringFromDate } = require('./week');

const RULE_LABELS = {
  'EX-01': 'Single Visit No Follow-up',
  'EX-02': 'Repeat Visit No Enquiry',
  'EX-03': 'Repeat Visit No JSV',
  'EX-04': 'Follow-up Stagnation',
};

const ALLOWED_STATUSES = new Set(['open', 'in_review', 'resolved', 'ignored']);

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

function normalizeCustomerName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeContactType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['nc', 'fc', 'jsv', 'sc'].includes(normalized) ? normalized : '';
}

function normalizeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function resolveStage5Range(query = {}) {
  return resolveInsightsRange({
    from: query?.from,
    to: query?.to,
  });
}

function dayDiff(fromDateKey, toDateKey) {
  const fromDate = new Date(`${fromDateKey}T00:00:00.000Z`);
  const toDate = new Date(`${toDateKey}T00:00:00.000Z`);
  const diff = Math.floor((toDate - fromDate) / 86400000);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function toAgeingBucket(ageingDays) {
  if (ageingDays <= 7) return '0-7';
  if (ageingDays <= 14) return '8-14';
  return '15+';
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

function toStatusValue(input) {
  const normalized = String(input || '').trim().toLowerCase();
  return ALLOWED_STATUSES.has(normalized) ? normalized : '';
}

function toRuleValue(input) {
  const normalized = String(input || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(RULE_LABELS, normalized) ? normalized : '';
}

function buildCaseKey(ruleId, salesmanId, normalizedCustomer) {
  return `${ruleId}|${salesmanId}|${normalizedCustomer}`;
}

function buildStage5Candidates({ users, reports, range }) {
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

  const journeyMap = new Map();

  for (const report of reports || []) {
    const salesmanId = String(report.salesmanId);
    const user = usersById.get(salesmanId);
    if (!user) {
      continue;
    }

    const actualByDate = new Map();
    for (const row of report.actualOutputRows || []) {
      const dateKey = normalizeDateKey(row?.date);
      if (!dateKey) {
        continue;
      }

      actualByDate.set(dateKey, {
        visited: String(row?.visited || '').trim().toLowerCase(),
        enquiriesReceived: normalizeInteger(row?.enquiriesReceived),
        shipmentsConverted: normalizeInteger(row?.shipmentsConverted),
      });
    }

    for (const planningRow of report.planningRows || []) {
      if (!hasMeaningfulPlanningRow(planningRow)) {
        continue;
      }

      const dateKey = normalizeDateKey(planningRow.date);
      if (!dateKey || dateKey < fromDate || dateKey > toDate) {
        continue;
      }

      const customerName = String(planningRow.customerName || '').trim();
      const normalizedCustomer = normalizeCustomerName(customerName);
      if (!normalizedCustomer) {
        continue;
      }

      const actualRow = actualByDate.get(dateKey);
      const isVisited = actualRow?.visited === 'yes';
      if (!isVisited) {
        continue;
      }

      const journeyKey = `${salesmanId}|${normalizedCustomer}`;
      if (!journeyMap.has(journeyKey)) {
        journeyMap.set(journeyKey, {
          salesmanId,
          salesmanName: user.name || user.email,
          team: user.team,
          customerName,
          normalizedCustomer,
          totalVisited: 0,
          totalEnquiries: 0,
          totalShipments: 0,
          jsvCount: 0,
          followupVisitCount: 0,
          firstSeenDate: dateKey,
          latestSeenDate: dateKey,
          adminOwnerId: '',
          timeline: [],
        });
      }

      const journey = journeyMap.get(journeyKey);
      const contactType = normalizeContactType(planningRow.contactType);
      const jsvWithWhom = String(planningRow.jsvWithWhom || '').trim();

      journey.totalVisited += 1;
      journey.totalEnquiries += actualRow.enquiriesReceived;
      journey.totalShipments += actualRow.shipmentsConverted;
      journey.customerName = journey.customerName || customerName;

      if (contactType === 'jsv') {
        journey.jsvCount += 1;
        if (!journey.adminOwnerId && jsvWithWhom) {
          journey.adminOwnerId = jsvWithWhom;
        }
      }

      if (contactType === 'fc' || contactType === 'sc') {
        journey.followupVisitCount += 1;
      }

      if (dateKey < journey.firstSeenDate) {
        journey.firstSeenDate = dateKey;
      }
      if (dateKey > journey.latestSeenDate) {
        journey.latestSeenDate = dateKey;
      }

      journey.timeline.push({
        date: dateKey,
        contactType,
        visited: true,
        enquiriesReceived: actualRow.enquiriesReceived,
        shipmentsConverted: actualRow.shipmentsConverted,
      });
    }
  }

  const candidates = [];

  for (const journey of journeyMap.values()) {
    const matchedRules = [];

    if (journey.totalVisited === 1) {
      matchedRules.push('EX-01');
    }
    if (journey.totalVisited > 1 && journey.totalEnquiries === 0) {
      matchedRules.push('EX-02');
    }
    if (journey.totalVisited > 1 && journey.jsvCount === 0) {
      matchedRules.push('EX-03');
    }
    if (journey.followupVisitCount >= 3 && journey.totalShipments === 0) {
      matchedRules.push('EX-04');
    }

    for (const ruleId of matchedRules) {
      candidates.push({
        caseKey: buildCaseKey(ruleId, journey.salesmanId, journey.normalizedCustomer),
        ruleId,
        ruleLabel: RULE_LABELS[ruleId],
        customerName: journey.customerName,
        normalizedCustomer: journey.normalizedCustomer,
        salesmanId: journey.salesmanId,
        salesmanName: journey.salesmanName,
        team: journey.team,
        adminOwnerId: journey.adminOwnerId,
        firstSeenDate: journey.firstSeenDate,
        latestSeenDate: journey.latestSeenDate,
        metrics: {
          visitedCount: journey.totalVisited,
          enquiryCount: journey.totalEnquiries,
          shipmentCount: journey.totalShipments,
          jsvCount: journey.jsvCount,
          followupVisitCount: journey.followupVisitCount,
        },
        timeline: journey.timeline.sort((a, b) => a.date.localeCompare(b.date)),
      });
    }
  }

  return {
    candidates,
    filterOptions: {
      salesmen: salesmenOptions,
      team: Array.from(teamOptionsSet).sort((a, b) => a.localeCompare(b)),
      admin: adminOptions,
      rule: Object.keys(RULE_LABELS),
      status: Array.from(ALLOWED_STATUSES),
      ageingBucket: ['0-7', '8-14', '15+'],
    },
  };
}

function buildStage5Payload({ cases, range, filters = {}, filterOptions = {} }) {
  const toDate = String(range?.toWeek?.endDate || '').trim();

  const filterSalesmen = new Set((filters.salesmen || []).map((id) => String(id)));
  const filterTeam = String(filters.team || '').trim();
  const filterAdmin = String(filters.admin || '').trim();
  const filterRule = toRuleValue(filters.rule);
  const filterStatus = toStatusValue(filters.status);
  const filterCustomer = normalizeCustomerName(filters.customer);
  const filterAgeingBucket = String(filters.ageingBucket || '').trim();

  const rows = (cases || [])
    .map((item) => {
      const status = toStatusValue(item.status) || 'open';
      const firstSeenDate = normalizeDateKey(item.firstSeenDate);
      const latestSeenDate = normalizeDateKey(item.latestSeenDate);
      const ageingDays = firstSeenDate && toDate ? dayDiff(firstSeenDate, toDate) : 0;
      const ageingBucket = toAgeingBucket(ageingDays);

      return {
        id: String(item._id),
        caseKey: item.caseKey,
        ruleId: item.ruleId,
        ruleLabel: RULE_LABELS[item.ruleId] || item.ruleId,
        customerName: item.customerName,
        normalizedCustomer: item.normalizedCustomer,
        salesmanId: item.salesmanId,
        salesmanName: item.salesmanName,
        team: item.team || 'Unassigned',
        adminOwnerId: item.adminOwnerId || '',
        firstSeenDate,
        latestSeenDate,
        ageingDays,
        ageingBucket,
        status,
        active: item.active === true,
        resolvedAt: item.resolvedAt || null,
        metrics: item.metrics || {
          visitedCount: 0,
          enquiryCount: 0,
          shipmentCount: 0,
          jsvCount: 0,
          followupVisitCount: 0,
        },
        timeline: Array.isArray(item.timeline) ? item.timeline : [],
        statusHistory: Array.isArray(item.statusHistory) ? item.statusHistory : [],
      };
    })
    .filter((row) => {
      if (filterSalesmen.size > 0 && !filterSalesmen.has(String(row.salesmanId))) {
        return false;
      }
      if (filterTeam && row.team !== filterTeam) {
        return false;
      }
      if (filterAdmin && row.adminOwnerId !== filterAdmin) {
        return false;
      }
      if (filterRule && row.ruleId !== filterRule) {
        return false;
      }
      if (filterStatus && row.status !== filterStatus) {
        return false;
      }
      if (filterCustomer && !row.normalizedCustomer.includes(filterCustomer)) {
        return false;
      }
      if (filterAgeingBucket && row.ageingBucket !== filterAgeingBucket) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (b.ageingDays !== a.ageingDays) {
        return b.ageingDays - a.ageingDays;
      }
      if (a.ruleId !== b.ruleId) {
        return a.ruleId.localeCompare(b.ruleId);
      }
      return a.customerName.localeCompare(b.customerName);
    });

  const openRows = rows.filter((row) => row.status === 'open' || row.status === 'in_review');

  const openByRule = {
    'EX-01': 0,
    'EX-02': 0,
    'EX-03': 0,
    'EX-04': 0,
  };

  for (const row of openRows) {
    openByRule[row.ruleId] += 1;
  }

  const ageingBuckets = {
    '0-7': 0,
    '8-14': 0,
    '15+': 0,
  };

  for (const row of openRows) {
    ageingBuckets[row.ageingBucket] += 1;
  }

  const ownerBacklogMap = new Map();
  for (const row of openRows) {
    const key = row.salesmanId;
    if (!ownerBacklogMap.has(key)) {
      ownerBacklogMap.set(key, {
        ownerId: row.salesmanId,
        ownerName: row.salesmanName,
        team: row.team,
        open: 0,
      });
    }
    ownerBacklogMap.get(key).open += 1;
  }

  const resolvedVsOpenTrendMap = new Map();
  for (const week of range?.weeks || []) {
    resolvedVsOpenTrendMap.set(week.isoWeek, {
      week: week.isoWeek,
      opened: 0,
      resolved: 0,
    });
  }

  for (const row of rows) {
    if (row.firstSeenDate) {
      const openedWeek = getIsoWeekStringFromDate(new Date(`${row.firstSeenDate}T00:00:00.000Z`));
      const trendRow = resolvedVsOpenTrendMap.get(openedWeek);
      if (trendRow) {
        trendRow.opened += 1;
      }
    }

    if (row.resolvedAt) {
      const resolvedWeek = getIsoWeekStringFromDate(new Date(row.resolvedAt));
      const trendRow = resolvedVsOpenTrendMap.get(resolvedWeek);
      if (trendRow) {
        trendRow.resolved += 1;
      }
    }
  }

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
      admin: filterAdmin || null,
      rule: filterRule || null,
      status: filterStatus || null,
      customer: filterCustomer || null,
      ageingBucket: filterAgeingBucket || null,
    },
    summary: {
      totalRows: rows.length,
      openRows: openRows.length,
      openByRule,
      ageingBuckets,
      ownerBacklog: Array.from(ownerBacklogMap.values()).sort((a, b) => b.open - a.open),
      resolvedVsOpenTrend: Array.from(resolvedVsOpenTrendMap.values()).sort((a, b) =>
        a.week.localeCompare(b.week)
      ),
    },
    exceptions: {
      rows,
    },
    filterOptions,
  };
}

function validateStatusTransition(fromStatus, toStatus) {
  const current = toStatusValue(fromStatus);
  const next = toStatusValue(toStatus);

  if (!current || !next) {
    return { ok: false, message: 'Invalid status value' };
  }

  const allowed = {
    open: new Set(['in_review', 'resolved', 'ignored']),
    in_review: new Set(['open', 'resolved', 'ignored']),
    resolved: new Set(['open']),
    ignored: new Set(['open']),
  };

  if (current === next) {
    return { ok: true };
  }

  if (!allowed[current] || !allowed[current].has(next)) {
    return {
      ok: false,
      message: `Invalid status transition from ${current} to ${next}`,
    };
  }

  return { ok: true };
}

module.exports = {
  RULE_LABELS,
  ALLOWED_STATUSES,
  resolveStage5Range,
  buildStage5Candidates,
  buildStage5Payload,
  validateStatusTransition,
  normalizeCustomerName,
  toAgeingBucket,
};
