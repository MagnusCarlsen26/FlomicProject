const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStage2Payload } = require('./stage2ActivityCompliance');

function buildRange() {
  return {
    key: '2026-01-12',
    startDate: '2026-01-12',
    endDate: '2026-01-18',
    weekStartDateUtc: new Date('2026-01-12T00:00:00.000Z'),
    isoWeek: '2026-W03',
    timezone: 'Asia/Kolkata',
  };
}

function buildUsers() {
  return [
    { _id: 's1', name: 'Sales 1', email: 's1@example.com', role: 'salesman', mainTeam: 'M1', team: 'T1', subTeam: 'ST1' },
    { _id: 's2', name: 'Sales 2', email: 's2@example.com', role: 'salesman', mainTeam: 'M1', team: 'T1', subTeam: 'ST1' },
    { _id: 'm1', name: 'Member 1', email: 'm1@example.com', role: 'admin', mainTeam: 'M1', team: 'T1', subTeam: 'ST1' },
    { _id: 'm2', name: 'Member 2', email: 'm2@example.com', role: 'admin', mainTeam: 'M1', team: 'T1', subTeam: 'ST1' },
  ];
}

function buildReportForSalesperson(salesmanId, jsvDatesWithMember) {
  const planningRows = jsvDatesWithMember.map(({ date, memberId }, index) => ({
    date,
    customerName: `C-${salesmanId}-${index}`,
    contactType: 'jsv',
    jsvWithWhom: memberId,
  }));

  const actualOutputRows = jsvDatesWithMember.map(({ date }) => ({
    date,
    visited: 'yes',
  }));

  return {
    salesmanId,
    weekKey: '2026-01-12',
    planningRows,
    actualOutputRows,
  };
}

test('member with 5 JSV is non-compliant and member with 6 JSV is compliant', () => {
  const users = buildUsers();
  const reports = [
    buildReportForSalesperson('s1', [
      { date: '2026-01-12', memberId: 'm1' },
      { date: '2026-01-13', memberId: 'm1' },
      { date: '2026-01-14', memberId: 'm1' },
    ]),
    buildReportForSalesperson('s2', [
      { date: '2026-01-15', memberId: 'm1' },
      { date: '2026-01-16', memberId: 'm1' },
      { date: '2026-01-17', memberId: 'm2' },
      { date: '2026-01-18', memberId: 'm2' },
      { date: '2026-01-12', memberId: 'm2' },
      { date: '2026-01-13', memberId: 'm2' },
      { date: '2026-01-14', memberId: 'm2' },
      { date: '2026-01-15', memberId: 'm2' },
    ]),
  ];

  const payload = buildStage2Payload({ users, reports, range: buildRange(), filters: {} });
  const member1 = payload.subteamMemberCards.find((card) => card.member.id === 'm1');
  const member2 = payload.subteamMemberCards.find((card) => card.member.id === 'm2');

  assert.equal(member1.stats.jsvCount, 5);
  assert.equal(member1.stats.isCompliant, false);
  assert.equal(member1.stats.threshold, 6);
  assert.equal(member1.stats.shortfall, 1);
  assert.match(member1.alerts[0].message, /5\/6 required/i);

  assert.equal(member2.stats.jsvCount, 6);
  assert.equal(member2.stats.isCompliant, true);
  assert.equal(member2.stats.shortfall, 0);
  assert.equal(member2.alerts.length, 0);
});

test('contributors are aggregated per member across multiple salespeople', () => {
  const users = buildUsers();
  const reports = [
    buildReportForSalesperson('s1', [
      { date: '2026-01-12', memberId: 'm1' },
      { date: '2026-01-13', memberId: 'm1' },
      { date: '2026-01-14', memberId: 'm1' },
      { date: '2026-01-15', memberId: 'm1' },
    ]),
    buildReportForSalesperson('s2', [
      { date: '2026-01-16', memberId: 'm1' },
      { date: '2026-01-17', memberId: 'm1' },
    ]),
  ];

  const payload = buildStage2Payload({ users, reports, range: buildRange(), filters: {} });
  const member1 = payload.subteamMemberCards.find((card) => card.member.id === 'm1');

  assert.equal(member1.stats.jsvCount, 6);
  assert.equal(member1.stats.isCompliant, true);
  assert.equal(member1.contributors.length, 2);
  assert.deepEqual(member1.contributors.map((row) => row.salespersonId), ['s1', 's2']);
  assert.deepEqual(member1.contributors.map((row) => row.jsvCountWithMember), [4, 2]);
});
