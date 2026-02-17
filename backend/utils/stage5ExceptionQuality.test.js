const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStage5Candidates,
  buildStage5Payload,
  resolveStage5Range,
  validateStatusTransition,
  normalizeCustomerName,
  toAgeingBucket,
} = require('./stage5ExceptionQuality');

test('normalizeCustomerName collapses spaces and lowercases', () => {
  assert.equal(normalizeCustomerName('  Acme   Corp  '), 'acme corp');
});

test('toAgeingBucket maps ageing ranges', () => {
  assert.equal(toAgeingBucket(0), '0-7');
  assert.equal(toAgeingBucket(8), '8-14');
  assert.equal(toAgeingBucket(15), '15+');
});

test('buildStage5Candidates detects EX-01 to EX-04 deterministically', () => {
  const users = [
    { _id: 's1', name: 'Sales One', email: 's1@example.com', role: 'salesman', team: 'Team A' },
    { _id: 'a1', name: 'Admin One', email: 'a1@example.com', role: 'admin', team: 'Team A' },
  ];

  const reports = [
    {
      salesmanId: 's1',
      planningRows: [
        { date: '2026-02-09', customerName: 'Single', contactType: 'nc' },
        { date: '2026-02-10', customerName: 'NoEnquiry', contactType: 'fc' },
        { date: '2026-02-11', customerName: 'NoEnquiry', contactType: 'sc' },
        { date: '2026-02-12', customerName: 'NoJsv', contactType: 'nc' },
        { date: '2026-02-13', customerName: 'NoJsv', contactType: 'fc' },
        { date: '2026-02-14', customerName: 'Stagnant', contactType: 'fc' },
        { date: '2026-02-15', customerName: 'Stagnant', contactType: 'sc' },
      ],
      actualOutputRows: [
        { date: '2026-02-09', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
        { date: '2026-02-10', visited: 'yes', enquiriesReceived: 0, shipmentsConverted: 0 },
        { date: '2026-02-11', visited: 'yes', enquiriesReceived: 0, shipmentsConverted: 0 },
        { date: '2026-02-12', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
        { date: '2026-02-13', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
        { date: '2026-02-14', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
        { date: '2026-02-15', visited: 'yes', enquiriesReceived: 1, shipmentsConverted: 0 },
      ],
    },
    {
      salesmanId: 's1',
      planningRows: [{ date: '2026-02-16', customerName: 'Stagnant', contactType: 'fc', jsvWithWhom: 'a1' }],
      actualOutputRows: [{ date: '2026-02-16', visited: 'yes', enquiriesReceived: 0, shipmentsConverted: 0 }],
    },
  ];

  const range = resolveStage5Range({ from: '2026-W06', to: '2026-W08' });
  const result = buildStage5Candidates({ users, reports, range });

  const keys = new Set(result.candidates.map((row) => row.caseKey));
  assert.equal(keys.has('EX-01|s1|single'), true);
  assert.equal(keys.has('EX-02|s1|noenquiry'), true);
  assert.equal(keys.has('EX-03|s1|noenquiry'), true);
  assert.equal(keys.has('EX-03|s1|nojsv'), true);
  assert.equal(keys.has('EX-04|s1|stagnant'), true);
});

test('buildStage5Payload computes open summary and filters', () => {
  const range = resolveStage5Range({ from: '2026-W06', to: '2026-W08' });
  const payload = buildStage5Payload({
    range,
    filters: { status: 'open', rule: 'ex-03' },
    filterOptions: {
      salesmen: [{ id: 's1', name: 'Sales One' }],
      team: ['Team A'],
      admin: [],
      rule: ['EX-01', 'EX-02', 'EX-03', 'EX-04'],
      status: ['open', 'in_review', 'resolved', 'ignored'],
      ageingBucket: ['0-7', '8-14', '15+'],
    },
    cases: [
      {
        _id: 'c1',
        caseKey: 'EX-03|s1|acme',
        ruleId: 'EX-03',
        customerName: 'Acme',
        normalizedCustomer: 'acme',
        salesmanId: 's1',
        salesmanName: 'Sales One',
        team: 'Team A',
        status: 'open',
        active: true,
        firstSeenDate: '2026-02-10',
        latestSeenDate: '2026-02-14',
        resolvedAt: null,
      },
      {
        _id: 'c2',
        caseKey: 'EX-02|s2|bravo',
        ruleId: 'EX-02',
        customerName: 'Bravo',
        normalizedCustomer: 'bravo',
        salesmanId: 's2',
        salesmanName: 'Sales Two',
        team: 'Team B',
        status: 'resolved',
        active: false,
        firstSeenDate: '2026-02-10',
        latestSeenDate: '2026-02-14',
        resolvedAt: new Date('2026-02-16T00:00:00.000Z'),
      },
    ],
  });

  assert.equal(payload.exceptions.rows.length, 1);
  assert.equal(payload.summary.openByRule['EX-03'], 1);
  assert.equal(payload.summary.openRows, 1);
});

test('validateStatusTransition enforces allowed transitions', () => {
  assert.equal(validateStatusTransition('open', 'resolved').ok, true);
  assert.equal(validateStatusTransition('resolved', 'ignored').ok, false);
  assert.equal(validateStatusTransition('ignored', 'open').ok, true);
});
