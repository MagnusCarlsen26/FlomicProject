const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStage4Payload,
  DEFAULT_THRESHOLDS,
  resolveStage4Range,
  safeDivide,
} = require('./stage4EnquiryEffectiveness');

test('resolveStage4Range defaults to insights-style weekly range', () => {
  const range = resolveStage4Range({ to: '2026-W07' });
  assert.equal(Boolean(range.error), false);
  assert.equal(range.toWeek.isoWeek, '2026-W07');
  assert.equal(range.weeks.length, 12);

  const invalid = resolveStage4Range({ from: '2026-W08', to: '2026-W07' });
  assert.match(invalid.error, /from must be less than or equal to to/i);
});

test('safeDivide returns zero on zero denominator', () => {
  assert.equal(safeDivide(5, 0), 0);
  assert.equal(safeDivide(5, 2), 2.5);
});

test('buildStage4Payload computes KPIs, rollups, and flags', () => {
  const users = [
    { _id: 's1', name: 'Sales One', email: 's1@example.com', role: 'salesman', team: 'Team A' },
    { _id: 's2', name: 'Sales Two', email: 's2@example.com', role: 'salesman', team: 'Team B' },
    { _id: 'a1', name: 'Admin One', email: 'a1@example.com', role: 'admin', team: 'Team A' },
  ];

  const reports = [
    {
      salesmanId: 's1',
      weekKey: '2026-02-02',
      planningRows: [
        { date: '2026-02-02', customerName: 'C1', locationArea: 'North', contactType: 'nc', customerType: 'targeted_budgeted' },
        { date: '2026-02-03', customerName: 'C2', locationArea: 'North', contactType: 'fc', customerType: 'existing' },
        { date: '2026-02-04', customerName: 'C3', locationArea: 'South', contactType: 'jsv', customerType: 'existing', jsvWithWhom: 'a1' },
      ],
      actualOutputRows: [
        { date: '2026-02-02', visited: 'yes', enquiriesReceived: 2, shipmentsConverted: 0 },
        { date: '2026-02-03', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
        { date: '2026-02-04', visited: 'yes', enquiriesReceived: 0, shipmentsConverted: 1 },
      ],
    },
    {
      salesmanId: 's2',
      weekKey: '2026-02-02',
      planningRows: [
        { date: '2026-02-05', customerName: 'C4', locationArea: 'West', contactType: 'nc', customerType: 'targeted_budgeted' },
      ],
      actualOutputRows: [
        { date: '2026-02-05', visited: 'yes', enquiriesReceived: 0, shipmentsConverted: 0 },
      ],
    },
  ];

  const payload = buildStage4Payload({
    users,
    reports,
    range: resolveStage4Range({ from: '2026-W06', to: '2026-W07' }),
    filters: {},
    thresholds: {
      minVisitsForLowEnquiry: 1,
      minEnquiryPerVisit: 0.9,
      minEnquiriesForLowConversion: 1,
      minShipmentConversion: 0.5,
    },
  });

  assert.equal(payload.totals.plannedVisits, 4);
  assert.equal(payload.totals.actualVisits, 4);
  assert.equal(payload.totals.enquiries, 3);
  assert.equal(payload.totals.shipments, 1);

  assert.equal(payload.kpis.visitToEnquiryRatio.value, 0.75);
  assert.equal(payload.kpis.enquiryToShipmentConversion.value, 0.3333);

  assert.equal(payload.tables.salesperson.length, 2);
  assert.equal(payload.tables.hod.length, 2);
  assert.equal(payload.trends.weekly.length >= 1, true);

  assert.equal(payload.flags.summary.total > 0, true);
  assert.equal(payload.flags.summary.byType.low_conversion > 0, true);
});

test('buildStage4Payload applies admin filter only to jsv rows', () => {
  const users = [
    { _id: 's1', name: 'Sales One', email: 's1@example.com', role: 'salesman', team: 'Team A' },
    { _id: 'a1', name: 'Admin One', email: 'a1@example.com', role: 'admin', team: 'Team A' },
    { _id: 'a2', name: 'Admin Two', email: 'a2@example.com', role: 'admin', team: 'Team A' },
  ];

  const reports = [
    {
      salesmanId: 's1',
      weekKey: '2026-02-02',
      planningRows: [
        { date: '2026-02-02', customerName: 'NC', locationArea: 'North', contactType: 'nc', customerType: 'targeted_budgeted' },
        { date: '2026-02-03', customerName: 'JSV1', locationArea: 'North', contactType: 'jsv', customerType: 'existing', jsvWithWhom: 'a1' },
        { date: '2026-02-04', customerName: 'JSV2', locationArea: 'North', contactType: 'jsv', customerType: 'existing', jsvWithWhom: 'a2' },
      ],
      actualOutputRows: [
        { date: '2026-02-02', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
        { date: '2026-02-03', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 1 },
        { date: '2026-02-04', visited: 'yes', enquiriesReceived: 5, shipmentsConverted: 5 },
      ],
    },
  ];

  const range = resolveStage4Range({ from: '2026-W06', to: '2026-W07' });

  const unfiltered = buildStage4Payload({ users, reports, range, filters: {}, thresholds: DEFAULT_THRESHOLDS });
  const filtered = buildStage4Payload({
    users,
    reports,
    range,
    filters: { admin: 'a1' },
    thresholds: DEFAULT_THRESHOLDS,
  });

  // Non-JSV row remains; one of two JSV rows is filtered out.
  assert.equal(unfiltered.totals.plannedVisits, 3);
  assert.equal(filtered.totals.plannedVisits, 2);
  assert.equal(filtered.totals.enquiries, 2);
  assert.equal(filtered.totals.shipments, 1);
});
