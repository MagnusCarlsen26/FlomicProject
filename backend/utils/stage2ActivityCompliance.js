const { resolveWeekFromQuery } = require('./week');

const TARGETS = {
  totalCalls: 20,
  ncCount: 5,
  jsvCount: 5,
};

const JSV_THRESHOLD = 6; // strict > 5/week

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

function buildMemberCard(user) {
  const userId = String(user._id);
  return {
    member: {
      id: userId,
      name: user.name || user.email,
      email: user.email || '',
      role: user.role || 'salesman',
      mainTeam: user.mainTeam || 'Unassigned',
      team: user.team || 'Unassigned',
      subTeam: user.subTeam || 'Unassigned',
    },
    stats: {
      jsvCount: 0,
      threshold: JSV_THRESHOLD,
      shortfall: JSV_THRESHOLD,
      isCompliant: false,
    },
    contributors: new Map(),
    alerts: [],
  };
}

function buildStage2Payload({ users, reports, range, filters }) {
  const usersById = new Map(users.map((u) => [String(u._id), u]));
  const reportsBySalespersonId = new Map(reports.map((report) => [String(report.salesmanId), report]));

  const subteamMemberCardsMap = new Map();
  users
    .filter((user) => String(user.role || '').toLowerCase() === 'admin')
    .forEach((user) => {
    const userId = String(user._id);
    subteamMemberCardsMap.set(userId, buildMemberCard(user));
    });

  const salesmanCards = [];
  const drilldown = [];

  for (const user of users) {
    const userId = String(user._id);
    const report = reportsBySalespersonId.get(userId);

    const stats = {
      totalCalls: 0,
      ncCount: 0,
      jsvCount: 0,
      fcCount: 0,
      scCount: 0,
    };

    const actualMap = new Map();
    if (report) {
      (report.actualOutputRows || []).forEach((row) => {
        if (row.visited === 'yes') {
          actualMap.set(row.date, true);
        }
      });

      (report.planningRows || []).forEach((planRow) => {
        if (!hasMeaningfulPlanningRow(planRow)) return;
        if (!actualMap.get(planRow.date)) return;

        stats.totalCalls++;
        const type = String(planRow.contactType || '').trim().toLowerCase();

        if (type === 'nc') stats.ncCount++;
        if (type === 'fc') stats.fcCount++;
        if (type === 'sc') stats.scCount++;

        if (type === 'jsv') {
          stats.jsvCount++;

          const memberId = String(planRow.jsvWithWhom || '').trim();
          if (memberId && subteamMemberCardsMap.has(memberId)) {
            const memberCard = subteamMemberCardsMap.get(memberId);
            memberCard.stats.jsvCount++;

            const contributor = memberCard.contributors.get(userId) || {
              salespersonId: userId,
              name: user.name || user.email,
              jsvCountWithMember: 0,
            };
            contributor.jsvCountWithMember++;
            memberCard.contributors.set(userId, contributor);
          }
        }

        const memberId = String(planRow.jsvWithWhom || '').trim();
        const member = memberId && usersById.has(memberId) ? usersById.get(memberId) : null;
        drilldown.push({
          salesperson: {
            id: userId,
            name: user.name || user.email,
            team: user.team || 'Unassigned',
          },
          member: member
            ? {
                id: String(member._id),
                name: member.name || member.email,
                team: member.team || 'Unassigned',
                subTeam: member.subTeam || 'Unassigned',
              }
            : null,
          date: planRow.date,
          type,
          customerName: planRow.customerName,
        });
      });
    }

    salesmanCards.push({
      salesman: {
        id: userId,
        name: user.name || user.email,
        team: user.team || 'Unassigned',
        mainTeam: user.mainTeam || 'Unassigned',
      },
      stats,
      alerts: [],
      isCompliant: true,
    });
  }

  const alertBreakdown = { type: {}, severity: { critical: 0, warning: 0 } };
  let compliantCount = 0;
  let nonCompliantCount = 0;

  const subteamMemberCards = Array.from(subteamMemberCardsMap.values())
    .map((card) => {
      const jsvCount = card.stats.jsvCount;
      const isCompliant = jsvCount >= JSV_THRESHOLD;
      const shortfall = Math.max(0, JSV_THRESHOLD - jsvCount);
      const alerts = [];

      if (!isCompliant) {
        alerts.push({
          ruleKey: 'subteamMemberJsv',
          severity: 'critical',
          status: 'open',
          current: jsvCount,
          target: JSV_THRESHOLD,
          shortfall,
          message: `Weekly JSV target missed (${jsvCount}/${JSV_THRESHOLD} required)`,
          recommendation: 'Increase joint sales visits this week.',
        });
        alertBreakdown.severity.critical++;
        alertBreakdown.type.subteamMemberJsv = (alertBreakdown.type.subteamMemberJsv || 0) + 1;
        nonCompliantCount++;
      } else {
        compliantCount++;
      }

      return {
        member: card.member,
        stats: {
          jsvCount,
          threshold: JSV_THRESHOLD,
          shortfall,
          isCompliant,
        },
        contributors: Array.from(card.contributors.values()).sort(
          (a, b) => b.jsvCountWithMember - a.jsvCountWithMember,
        ),
        alerts,
      };
    })
    .sort((a, b) => {
      const byJsv = b.stats.jsvCount - a.stats.jsvCount;
      if (byJsv !== 0) return byJsv;
      return (a.member.name || '').localeCompare(b.member.name || '');
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
    subteamMemberCards,
    drilldown,
    filters: filters || {},
    targets: TARGETS,
  };
}

module.exports = {
  resolveStage2Range,
  buildStage2Payload,
};
