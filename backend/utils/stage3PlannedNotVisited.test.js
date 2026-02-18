const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStage3Payload, resolveStage3Range } = require('./stage3PlannedNotVisited');

test('resolveStage3Range supports week and range', () => {
  const weekRange = resolveStage3Range({ week: '2026-W07' });
  assert.equal(weekRange.fromDate, '2026-02-09');
  assert.equal(weekRange.toDate, '2026-02-15');

  const directRange = resolveStage3Range({ from: '2026-02-05', to: '2026-02-10' });
  assert.equal(directRange.fromDate, '2026-02-05');
  assert.equal(directRange.toDate, '2026-02-10');
});

test('buildStage3Payload counts planned-not-visited and detects recurrence', () => {
  const users = [
    { _id: 'u1', name: 'Salesman A', email: 'a@example.com', mainTeam: 'M1', team: 'T1', subTeam: 'S1' }
  ];

  const reports = [
    {
      salesmanId: 'u1',
      weekKey: '2026-W06',
      planningRows: [{ date: '2026-02-02', customerName: 'Frequent Customer' }],
      actualOutputRows: [{ date: '2026-02-02', visited: 'no', notVisitedReasonCategory: 'no_response' }]
    },
    {
      salesmanId: 'u1',
      weekKey: '2026-W07',
      planningRows: [
        { date: '2026-02-09', customerName: 'Frequent Customer' },
        { date: '2026-02-10', customerName: 'One Timer' }
      ],
      actualOutputRows: [
        { date: '2026-02-09', visited: 'no', notVisitedReasonCategory: 'no_response' },
        { date: '2026-02-10', visited: 'no', notVisitedReasonCategory: 'client_unavailable' }
      ]
    }
  ];

  const payload = buildStage3Payload({
    users,
    reports,
    range: { fromDate: '2026-02-09', toDate: '2026-02-15', timezone: 'UTC', label: 'W07' },
    filters: {}
  });

  // Range Stats (W07 only)
  assert.equal(payload.totals.plannedVisits, 2);
  assert.equal(payload.totals.plannedButNotVisitedCount, 2);
  assert.equal(payload.totals.nonVisitRate, 1.0);

  // Recurrence (W06 + W07)
  // Frequent Customer appears in 2 distinct weeks
  const frequent = payload.topRepeatedCustomers.find(c => c.customerName === 'Frequent Customer');
  assert.ok(frequent);
  assert.equal(frequent.occurrences8w, 2);
  assert.equal(frequent.dominantReasonCategory, 'no_response');

  // One Timer only appears in 1 week, should not be in repeated list
  const oneTimer = payload.topRepeatedCustomers.find(c => c.customerName === 'One Timer');
  assert.equal(oneTimer, undefined);
});

test('buildStage3Payload applies filters correctly', () => {
  const users = [
    { _id: 'u1', name: 'A', mainTeam: 'T1' },
    { _id: 'u2', name: 'B', mainTeam: 'T2' }
  ];
  const reports = [
    {
      salesmanId: 'u1',
      weekKey: 'W1',
      planningRows: [{ date: '2026-02-09', customerName: 'Cust A' }],
      actualOutputRows: [{ date: '2026-02-09', visited: 'no', notVisitedReasonCategory: 'no_response' }]
    },
    {
      salesmanId: 'u2',
      weekKey: 'W1',
      planningRows: [{ date: '2026-02-09', customerName: 'Cust B' }],
      actualOutputRows: [{ date: '2026-02-09', visited: 'no', notVisitedReasonCategory: 'client_unavailable' }]
    }
  ];

  const payload = buildStage3Payload({
    users,
    reports,
    range: { fromDate: '2026-02-09', toDate: '2026-02-15' },
    filters: { mainTeam: 'T1' }
  });

  assert.equal(payload.totals.plannedVisits, 1);
  assert.equal(payload.drilldownRows[0].salesmanName, 'A');
});
