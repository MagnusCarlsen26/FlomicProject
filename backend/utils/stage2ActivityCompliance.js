const { IST_TIME_ZONE, formatDateKey, resolveWeekFromQuery, getWeekParts } = require('./week');

const TARGETS = {
  totalCalls: 20,
  ncCount: 5,
  jsvCount: 5,
};

function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function resolveStage2Range(query) {
  const week = resolveWeekFromQuery(query.week);
  if (!week) {
    return { error: 'Invalid week query. Use YYYY-Www (example: 2026-W07) or YYYY-MM-DD' };
  }
  return week;
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

function buildStage2Payload({ users, reports, range, filters }) {
  const currentWeek = getWeekParts();
  const isPastWeek = range.weekStartDateUtc < currentWeek.weekStartDateUtc;
  const isCurrentWeek = range.key === currentWeek.key;

  // Calculate elapsed days for pro-rating warnings
  let elapsedDays = 7;
  if (isCurrentWeek) {
    const now = new Date();
    // Simple calculation: difference in days from week start in IST
    const start = range.weekStartDateUtc;
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
    elapsedDays = Math.max(1, Math.min(7, diff));
  }

  const getExpectedPace = (target) => Math.ceil((target * elapsedDays) / 7);

  const usersById = new Map(users.map(u => [String(u._id), u]));
  const adminUsers = users.filter(u => u.role === 'admin');
  const adminIds = new Set(adminUsers.map(u => String(u._id)));

  const salesmanCards = [];
  const adminCards = new Map(adminUsers.map(admin => [String(admin._id), {
    admin: { id: String(admin._id), name: admin.name || admin.email },
    jsvCount: 0,
    salespersonBreakdown: new Map(),
    alerts: [],
  }]));

  const drilldown = [];
  let compliantCount = 0;
  let nonCompliantCount = 0;
  const alertBreakdown = { type: {}, severity: { critical: 0, warning: 0 } };

  for (const user of users) {
    const userId = String(user._id);
    const report = reports.find(r => String(r.salesmanId) === userId);
    
    const stats = {
      totalCalls: 0,
      ncCount: 0,
      jsvCount: 0,
      fcCount: 0,
      scCount: 0,
    };

    const actualMap = new Map();
    if (report) {
      report.actualOutputRows.forEach(row => {
        if (row.visited === 'yes') {
          actualMap.set(row.date, true);
        }
      });

      report.planningRows.forEach(planRow => {
        if (!hasMeaningfulPlanningRow(planRow)) return;
        if (actualMap.get(planRow.date)) {
          stats.totalCalls++;
          const type = String(planRow.contactType).toLowerCase();
          if (type === 'nc') stats.ncCount++;
          if (type === 'jsv') {
            stats.jsvCount++;
            const adminId = planRow.jsvWithWhom;
            if (adminId && adminIds.has(adminId) && adminCards.has(adminId)) {
              const adminCard = adminCards.get(adminId);
              adminCard.jsvCount++;
              const currentBreakdown = adminCard.salespersonBreakdown.get(userId) || {
                salespersonId: userId,
                name: user.name || user.email,
                jsvCountWithAdmin: 0,
              };
              currentBreakdown.jsvCountWithAdmin++;
              adminCard.salespersonBreakdown.set(userId, currentBreakdown);
            }
          }
          if (type === 'fc') stats.fcCount++;
          if (type === 'sc') stats.scCount++;

          drilldown.push({
            salesperson: { id: userId, name: user.name || user.email },
            date: planRow.date,
            type,
            customerName: planRow.customerName,
          });
        }
      });
    }

    const alerts = [];
    const evaluateRule = (key, current, target, label) => {
      const expected = getExpectedPace(target);
      let severity = null;
      let message = '';

      if (isPastWeek && current < target) {
        severity = 'critical';
        message = `${label} target missed (${current}/${target})`;
      } else if (isCurrentWeek) {
        if (current < expected) {
          severity = 'warning';
          message = `${label} below pace (${current}/${expected})`;
        }
      }

      if (severity) {
        alerts.push({
          ruleKey: key,
          severity,
          status: 'open',
          current,
          target: isPastWeek ? target : expected,
          shortfall: (isPastWeek ? target : expected) - current,
          message,
          recommendation: `Increase ${label} activity to meet ${isPastWeek ? 'weekly' : 'daily'} target.`,
        });
        alertBreakdown.severity[severity]++;
        alertBreakdown.type[key] = (alertBreakdown.type[key] || 0) + 1;
      }
    };

    evaluateRule('totalCalls', stats.totalCalls, TARGETS.totalCalls, 'Total Calls');
    evaluateRule('ncCount', stats.ncCount, TARGETS.ncCount, 'New Calls');
    evaluateRule('jsvCount', stats.jsvCount, TARGETS.jsvCount, 'Joint Sales Visits');

    // Service-heavy rule
    const isServiceHeavy = safeDivide(stats.scCount, stats.totalCalls) > 0.5;
    if (isServiceHeavy && stats.ncCount < getExpectedPace(TARGETS.ncCount)) {
      const severity = isPastWeek ? 'critical' : 'warning';
      alerts.push({
        ruleKey: 'serviceHeavy',
        severity,
        status: 'open',
        current: stats.scCount,
        message: 'High Service Call ratio with low New Call pace',
        recommendation: 'Balance service calls with more new business acquisition.',
      });
      alertBreakdown.severity[severity]++;
      alertBreakdown.type['serviceHeavy'] = (alertBreakdown.type['serviceHeavy'] || 0) + 1;
    }

    if (alerts.length > 0) nonCompliantCount++;
    else compliantCount++;

    salesmanCards.push({
      salesman: {
        id: userId,
        name: user.name || user.email,
        team: user.team,
        mainTeam: user.mainTeam,
      },
      stats,
      alerts,
      isCompliant: alerts.length === 0,
    });
  }

  const finalAdminCards = Array.from(adminCards.values()).map(card => {
    const breakdownArray = Array.from(card.salespersonBreakdown.values());
    const totalJsv = card.jsvCount;
    breakdownArray.forEach(b => {
      b.sharePct = totalJsv > 0 ? (b.jsvCountWithAdmin / totalJsv) : 0;
    });

    const topContributor = breakdownArray.sort((a, b) => b.sharePct - a.sharePct)[0];
    const unevenParticipation = topContributor && topContributor.sharePct > 0.6 && totalJsv >= 5;
    
    const alerts = [];
    const expectedJsv = getExpectedPace(5);
    if (isPastWeek && totalJsv < 5) {
      alerts.push({
        ruleKey: 'adminJsv',
        severity: 'critical',
        message: `Weekly JSV target missed (${totalJsv}/5)`,
      });
    } else if (isCurrentWeek && totalJsv < expectedJsv) {
      alerts.push({
        ruleKey: 'adminJsv',
        severity: 'warning',
        message: `JSV below pace (${totalJsv}/${expectedJsv})`,
      });
    }

    if (unevenParticipation) {
      alerts.push({
        ruleKey: 'unevenParticipation',
        severity: 'warning',
        message: `Uneven participation detected: ${topContributor.name} has ${Math.round(topContributor.sharePct * 100)}% share.`,
      });
    }

    return {
      ...card,
      salespersonBreakdown: breakdownArray,
      unevenParticipation,
      alerts,
    };
  });

  return {
    week: {
      key: range.key,
      start: range.startDate,
      end: range.endDate,
      isoWeek: range.isoWeek,
      timezone: range.timezone,
    },
    summary: {
      totalUsers: users.length,
      compliantCount,
      nonCompliantCount,
      alertBreakdown,
    },
    salesmanCards,
    adminCards: finalAdminCards,
    drilldown,
  };
}

module.exports = {
  resolveStage2Range,
  buildStage2Payload,
};
