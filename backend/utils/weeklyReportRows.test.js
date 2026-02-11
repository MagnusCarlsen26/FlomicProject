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
