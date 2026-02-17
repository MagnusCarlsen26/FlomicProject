const test = require('node:test');
const assert = require('node:assert/strict');

const { getWeekParts } = require('./week');
const {
  buildDefaultActualOutputRows,
  buildDefaultPlanningRows,
  normalizeActualOutputRows,
  normalizePlanningRows,
} = require('./weeklyReportRows');

test('build default rows creates exactly 7 rows', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const planningRows = buildDefaultPlanningRows(week);
  const actualRows = buildDefaultActualOutputRows(week);

  assert.equal(planningRows.length, 7);
  assert.equal(actualRows.length, 7);
  assert.equal(planningRows[0].date, week.startDate);
});

test('normalizePlanningRows rejects invalid contact type', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultPlanningRows(week).map((row) => ({ ...row }));
  rows[0].contactType = 'wrong';

  const result = normalizePlanningRows(rows, week);
  assert.ok(result.error);
  assert.match(result.error, /contactType/i);
});

test('normalizePlanningRows accepts admin id for jsvWithWhom', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultPlanningRows(week).map((row) => ({ ...row }));
  rows[0].contactType = 'jsv';
  rows[0].jsvWithWhom = 'admin-1';

  const result = normalizePlanningRows(rows, week, {
    allowedAdminIds: new Set(['admin-1', 'admin-2']),
  });

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0].jsvWithWhom, 'admin-1');
});

test('normalizeActualOutputRows requires notVisitedReasonCategory when visited is no', () => {
  const week = { weekStartDateUtc: new Date('2026-02-09T00:00:00.000Z') };
  const build7 = (row) => [
    row,
    ...['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14', '2026-02-15'].map(d => ({ date: d, visited: '' }))
  ];

  // Missing category for new row
  const result1 = normalizeActualOutputRows(build7({ date: '2026-02-09', visited: 'no', notVisitedReason: 'text' }), week);
  assert.match(result1.error, /notVisitedReasonCategory is required/i);

  // Invalid category
  const result2 = normalizeActualOutputRows(build7({ date: '2026-02-09', visited: 'no', notVisitedReason: 'text', notVisitedReasonCategory: 'invalid' }), week);
  assert.match(result2.error, /notVisitedReasonCategory is invalid/i);

  // Valid category
  const result3 = normalizeActualOutputRows(build7({ date: '2026-02-09', visited: 'no', notVisitedReason: 'text', notVisitedReasonCategory: 'client_unavailable' }), week);
  assert.equal(result3.error, undefined);
  assert.equal(result3.rows[0].notVisitedReasonCategory, 'client_unavailable');
});

test('normalizeActualOutputRows allows unchanged legacy row without category', () => {
  const week = { weekStartDateUtc: new Date('2026-02-09T00:00:00.000Z') };
  const build7 = (row) => [
    row,
    ...['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14', '2026-02-15'].map(d => ({ date: d, visited: '' }))
  ];
  const existingRowsByDate = new Map([
    ['2026-02-09', { visited: 'no', notVisitedReason: 'old reason', notVisitedReasonCategory: '' }]
  ]);

  const options = { existingRowsByDate, allowLegacyUnchanged: true };

  // Unchanged - should pass
  const result1 = normalizeActualOutputRows(build7({ date: '2026-02-09', visited: 'no', notVisitedReason: 'old reason' }), week, options);
  assert.equal(result1.error, undefined);

  // Reason changed - should fail
  const result2 = normalizeActualOutputRows(build7({ date: '2026-02-09', visited: 'no', notVisitedReason: 'new reason' }), week, options);
  assert.match(result2.error, /notVisitedReasonCategory is required/i);
});

test('normalizePlanningRows rejects non-admin jsvWithWhom for new value', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultPlanningRows(week).map((row) => ({ ...row }));
  rows[0].contactType = 'jsv';
  rows[0].jsvWithWhom = 'Area Manager';

  const result = normalizePlanningRows(rows, week, {
    allowedAdminIds: new Set(['admin-1']),
  });

  assert.ok(result.error);
  assert.match(result.error, /jsvWithWhom must reference an admin user/i);
});

test('normalizePlanningRows allows unchanged legacy jsvWithWhom', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultPlanningRows(week).map((row) => ({ ...row }));
  const date = rows[0].date;
  rows[0].contactType = 'jsv';
  rows[0].jsvWithWhom = 'Legacy Lead';

  const result = normalizePlanningRows(rows, week, {
    allowedAdminIds: new Set(['admin-1']),
    existingRowsByDate: new Map([[date, { date, jsvWithWhom: 'Legacy Lead' }]]),
    allowLegacyUnchanged: true,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0].jsvWithWhom, 'Legacy Lead');
});

test('normalizePlanningRows rejects changed legacy jsvWithWhom', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultPlanningRows(week).map((row) => ({ ...row }));
  const date = rows[0].date;
  rows[0].contactType = 'jsv';
  rows[0].jsvWithWhom = 'Another Legacy';

  const result = normalizePlanningRows(rows, week, {
    allowedAdminIds: new Set(['admin-1']),
    existingRowsByDate: new Map([[date, { date, jsvWithWhom: 'Legacy Lead' }]]),
    allowLegacyUnchanged: true,
  });

  assert.ok(result.error);
  assert.match(result.error, /jsvWithWhom must reference an admin user/i);
});

test('normalizePlanningRows clears jsvWithWhom when contactType is not jsv', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultPlanningRows(week).map((row) => ({ ...row }));
  rows[0].contactType = 'fc';
  rows[0].jsvWithWhom = 'admin-1';

  const result = normalizePlanningRows(rows, week, {
    allowedAdminIds: new Set(['admin-1']),
  });

  assert.equal(result.error, undefined);
  assert.equal(result.rows[0].jsvWithWhom, '');
});

test('normalizeActualOutputRows requires reason when visited is no', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultActualOutputRows(week).map((row) => ({ ...row }));
  rows[1].visited = 'no';
  rows[1].notVisitedReason = '';

  const result = normalizeActualOutputRows(rows, week);
  assert.ok(result.error);
  assert.match(result.error, /notVisitedReason/i);
});

test('normalizeActualOutputRows rejects negative numbers', () => {
  const week = getWeekParts(new Date('2026-02-11T00:00:00.000Z'));
  const rows = buildDefaultActualOutputRows(week).map((row) => ({ ...row }));
  rows[2].enquiriesReceived = -1;

  const result = normalizeActualOutputRows(rows, week);
  assert.ok(result.error);
  assert.match(result.error, /non-negative integer/i);
});
