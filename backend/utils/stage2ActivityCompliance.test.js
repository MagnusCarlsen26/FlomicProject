const assert = require('assert');
const { buildStage2Payload } = require('./stage2ActivityCompliance');

// Mock data
const users = [
  { _id: 'u1', name: 'Salesman 1', role: 'salesman', team: 'T1', mainTeam: 'M1' },
  { _id: 'u2', name: 'Admin 1', role: 'admin', team: 'T2', mainTeam: 'M1' }
];

const reports = [
  {
    salesmanId: 'u1',
    weekKey: '2026-02-16',
    planningRows: [
      { date: '2026-02-16', contactType: 'nc', customerName: 'C1' },
      { date: '2026-02-17', contactType: 'jsv', jsvWithWhom: 'u2', customerName: 'C2' },
      { date: '2026-02-18', contactType: 'sc', customerName: 'C3' }
    ],
    actualOutputRows: [
      { date: '2026-02-16', visited: 'yes' },
      { date: '2026-02-17', visited: 'yes' },
      { date: '2026-02-18', visited: 'yes' }
    ]
  }
];

const range = {
  key: '2026-02-16',
  startDate: '2026-02-16',
  endDate: '2026-02-22',
  weekStartDateUtc: new Date('2026-02-16T00:00:00Z'),
  isoWeek: '2026-W08',
  timezone: 'Asia/Kolkata'
};

const payload = buildStage2Payload({ users, reports, range, filters: {} });

console.log('Testing compliance counts for u1...');
const card1 = payload.salesmanCards.find(c => c.salesman.id === 'u1');
assert.strictEqual(card1.stats.totalCalls, 3, 'Total calls should be 3');
assert.strictEqual(card1.stats.ncCount, 1, 'NC count should be 1');
assert.strictEqual(card1.stats.jsvCount, 1, 'JSV count should be 1');
assert.strictEqual(card1.stats.scCount, 1, 'SC count should be 1');

console.log('Testing admin card for u2...');
const adminCard = payload.adminCards.find(c => c.admin.id === 'u2');
assert.strictEqual(adminCard.jsvCount, 1, 'Admin JSV count should be 1');
assert.strictEqual(adminCard.salespersonBreakdown[0].jsvCountWithAdmin, 1, 'Breakdown count should be 1');

console.log('Unit tests passed!');
