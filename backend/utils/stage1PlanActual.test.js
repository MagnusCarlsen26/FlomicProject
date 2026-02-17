const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStage1Payload, resolveStage1Range } = require('./stage1PlanActual');

test('resolveStage1Range supports week, month and default range', () => {
  const weekRange = resolveStage1Range({ week: '2026-W07' });
  assert.equal(weekRange.error, undefined);
  assert.equal(weekRange.mode, 'week');
  assert.equal(weekRange.fromDate, '2026-02-09');
  assert.equal(weekRange.toDate, '2026-02-15');

  const monthRange = resolveStage1Range({ month: '2026-02' });
  assert.equal(monthRange.error, undefined);
  assert.equal(monthRange.mode, 'month');
  assert.equal(monthRange.fromDate, '2026-02-01');
  assert.equal(monthRange.toDate, '2026-02-28');

  const exactDateRange = resolveStage1Range({ from: '2026-02-05', to: '2026-02-20' });
  assert.equal(exactDateRange.error, undefined);
  assert.equal(exactDateRange.fromDate, '2026-02-05');
  assert.equal(exactDateRange.toDate, '2026-02-20');

  const invalidMonth = resolveStage1Range({ month: '2026-13' });
  assert.match(invalidMonth.error, /invalid month query/i);
});

test('buildStage1Payload computes totals, hierarchy and unknown call type', () => {
  const users = [
    {
      _id: 'u1',
      name: 'Alpha',
      email: 'alpha@example.com',
      mainTeam: 'Main A',
      team: 'Team 1',
      subTeam: 'Sub 1',
    },
    {
      _id: 'u2',
      name: 'Beta',
      email: 'beta@example.com',
      mainTeam: 'Main A',
      team: 'Team 1',
      subTeam: 'Sub 2',
    },
  ];

  const reports = [
    {
      salesmanId: 'u1',
      planningRows: [
        { date: '2026-02-09', customerName: 'A', contactType: 'nc', customerType: 'targeted_budgeted' },
        { date: '2026-02-10', customerName: 'B', contactType: '', customerType: 'existing' },
        { date: '2026-02-11', customerName: 'C', contactType: 'jsv', customerType: 'existing' },
      ],
      actualOutputRows: [
        { date: '2026-02-09', visited: 'yes' },
        { date: '2026-02-10', visited: 'no' },
        { date: '2026-02-11', visited: 'yes' },
      ],
    },
    {
      salesmanId: 'u2',
      planningRows: [
        { date: '2026-02-12', customerName: 'D', contactType: 'fc', customerType: 'existing' },
        { date: '2026-02-13', customerName: 'E', contactType: 'fc', customerType: 'existing' },
        { date: '2026-02-14', customerName: 'F', contactType: 'fc', customerType: 'existing' },
      ],
      actualOutputRows: [
        { date: '2026-02-12', visited: 'yes' },
        { date: '2026-02-13', visited: 'yes' },
        { date: '2026-02-14', visited: 'no' },
      ],
    },
  ];

  const payload = buildStage1Payload({
    users,
    reports,
    range: {
      fromDate: '2026-02-09',
      toDate: '2026-02-15',
      mode: 'week',
      label: '2026-W07',
    },
    filters: {},
  });

  assert.deepEqual(payload.totals, {
    plannedVisits: 6,
    actualVisits: 4,
    variance: 2,
    achievementRate: 0.6667,
  });
  assert.equal(payload.dailyTrend.length, 6);
  assert.equal(payload.weeklySummary.length, 1);
  assert.equal(payload.monthlyRollup.length, 1);
  assert.equal(payload.hierarchyRollups.salesperson.length, 2);
  assert.equal(payload.hierarchyRollups.mainTeam.length, 1);
  assert.equal(payload.hierarchyRollups.team.length, 1);
  assert.equal(payload.hierarchyRollups.subTeam.length, 2);

  const unknownType = payload.breakdowns.callType.find((row) => row.callType === 'unknown');
  assert.equal(unknownType.plannedVisits, 1);
  assert.equal(unknownType.actualVisits, 0);
});

test('buildStage1Payload ranks achievers with minimum planned threshold', () => {
  const users = [
    { _id: 'u1', name: 'A', email: 'a@example.com', mainTeam: 'M', team: 'T', subTeam: 'S1' },
    { _id: 'u2', name: 'B', email: 'b@example.com', mainTeam: 'M', team: 'T', subTeam: 'S2' },
    { _id: 'u3', name: 'C', email: 'c@example.com', mainTeam: 'M', team: 'T', subTeam: 'S3' },
  ];
  const reports = [
    {
      salesmanId: 'u1',
      planningRows: [
        { date: '2026-02-09', customerName: 'c1', contactType: 'nc' },
        { date: '2026-02-10', customerName: 'c2', contactType: 'nc' },
        { date: '2026-02-11', customerName: 'c3', contactType: 'nc' },
      ],
      actualOutputRows: [
        { date: '2026-02-09', visited: 'yes' },
        { date: '2026-02-10', visited: 'yes' },
        { date: '2026-02-11', visited: 'yes' },
      ],
    },
    {
      salesmanId: 'u2',
      planningRows: [
        { date: '2026-02-09', customerName: 'd1', contactType: 'fc' },
        { date: '2026-02-10', customerName: 'd2', contactType: 'fc' },
        { date: '2026-02-11', customerName: 'd3', contactType: 'fc' },
      ],
      actualOutputRows: [
        { date: '2026-02-09', visited: 'yes' },
        { date: '2026-02-10', visited: 'no' },
        { date: '2026-02-11', visited: 'no' },
      ],
    },
    {
      salesmanId: 'u3',
      planningRows: [{ date: '2026-02-09', customerName: 'e1', contactType: 'jsv' }],
      actualOutputRows: [{ date: '2026-02-09', visited: 'yes' }],
    },
  ];

  const payload = buildStage1Payload({
    users,
    reports,
    range: { fromDate: '2026-02-09', toDate: '2026-02-15', mode: 'week', label: '2026-W07' },
    filters: {},
  });

  assert.equal(payload.topPerformers.minimumPlannedVisits, 3);
  assert.equal(payload.topPerformers.overAchievers[0].id, 'u1');
  assert.equal(payload.topPerformers.underAchievers[0].id, 'u2');
  assert.equal(payload.topPerformers.overAchievers.find((row) => row.id === 'u3'), undefined);
});
