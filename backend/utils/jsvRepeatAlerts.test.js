const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInactiveAlert, buildJsvRepeatAlertsBySalesman } = require('./jsvRepeatAlerts');

test('buildInactiveAlert returns default non-triggered payload', () => {
  assert.deepEqual(buildInactiveAlert(3), {
    active: false,
    threshold: 3,
    customers: [],
    message: '',
  });
});

test('buildJsvRepeatAlertsBySalesman counts case-insensitive customer names with whitespace normalization', () => {
  const reports = [
    {
      salesmanId: 'u1',
      planningRows: [
        { customerName: ' Acme  Corp ', contactType: 'jsv' },
        { customerName: 'acme corp', contactType: 'jsv' },
        { customerName: 'ACME CORP', contactType: 'jsv' },
        { customerName: 'Acme Corp', contactType: 'jsv' },
      ],
    },
  ];

  const alerts = buildJsvRepeatAlertsBySalesman({ reports, threshold: 3 });
  assert.equal(alerts.get('u1').active, true);
  assert.equal(alerts.get('u1').customers.length, 1);
  assert.equal(alerts.get('u1').customers[0].customerName, 'Acme  Corp');
  assert.equal(alerts.get('u1').customers[0].count, 4);
});

test('buildJsvRepeatAlertsBySalesman applies strict greater-than threshold', () => {
  const reports = [
    {
      salesmanId: 'u2',
      planningRows: [
        { customerName: 'Bravo', contactType: 'jsv' },
        { customerName: 'Bravo', contactType: 'jsv' },
        { customerName: 'Bravo', contactType: 'jsv' },
        { customerName: 'Delta', contactType: 'jsv' },
        { customerName: 'Delta', contactType: 'jsv' },
        { customerName: 'Delta', contactType: 'jsv' },
        { customerName: 'Delta', contactType: 'jsv' },
      ],
    },
  ];

  const alerts = buildJsvRepeatAlertsBySalesman({ reports, threshold: 3 });
  assert.equal(alerts.get('u2').active, true);
  assert.deepEqual(alerts.get('u2').customers, [{ customerName: 'Delta', count: 4 }]);
});

test('buildJsvRepeatAlertsBySalesman returns all triggering customers sorted by count and name', () => {
  const reports = [
    {
      salesmanId: 'u3',
      planningRows: [
        { customerName: 'Zulu', contactType: 'jsv' },
        { customerName: 'Zulu', contactType: 'jsv' },
        { customerName: 'Zulu', contactType: 'jsv' },
        { customerName: 'Zulu', contactType: 'jsv' },
        { customerName: 'Alpha', contactType: 'jsv' },
        { customerName: 'Alpha', contactType: 'jsv' },
        { customerName: 'Alpha', contactType: 'jsv' },
        { customerName: 'Alpha', contactType: 'jsv' },
        { customerName: 'Beta', contactType: 'jsv' },
        { customerName: 'Beta', contactType: 'jsv' },
        { customerName: 'Beta', contactType: 'jsv' },
        { customerName: 'Beta', contactType: 'jsv' },
        { customerName: 'Beta', contactType: 'jsv' },
      ],
    },
  ];

  const alerts = buildJsvRepeatAlertsBySalesman({ reports, threshold: 3 });
  assert.equal(alerts.get('u3').active, true);
  assert.deepEqual(alerts.get('u3').customers, [
    { customerName: 'Beta', count: 5 },
    { customerName: 'Alpha', count: 4 },
    { customerName: 'Zulu', count: 4 },
  ]);
  assert.match(alerts.get('u3').message, /Beta \(5\)/);
  assert.match(alerts.get('u3').message, /Alpha \(4\)/);
  assert.match(alerts.get('u3').message, /Zulu \(4\)/);
});

test('buildJsvRepeatAlertsBySalesman ignores non-jsv and empty customer rows', () => {
  const reports = [
    {
      salesmanId: 'u4',
      planningRows: [
        { customerName: '', contactType: 'jsv' },
        { customerName: '   ', contactType: 'jsv' },
        { customerName: 'Acme', contactType: 'fc' },
        { customerName: 'Acme', contactType: 'sc' },
      ],
    },
  ];

  const alerts = buildJsvRepeatAlertsBySalesman({ reports, threshold: 3 });
  assert.deepEqual(alerts.get('u4'), {
    active: false,
    threshold: 3,
    customers: [],
    message: '',
  });
});
