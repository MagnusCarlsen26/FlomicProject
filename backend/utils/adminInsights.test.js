const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInsightsPayload, resolveInsightsRange } = require('./adminInsights');

function buildRange(from, to) {
  const resolved = resolveInsightsRange({ from, to });
  assert.equal(Boolean(resolved.error), false);
  return resolved;
}

test('resolveInsightsRange defaults to 12-week window and validates ordering', () => {
  const resolved = buildRange(null, '2026-W07');
  assert.equal(resolved.weeks.length, 12);
  assert.equal(resolved.toWeek.isoWeek, '2026-W07');

  const invalid = resolveInsightsRange({ from: '2026-W08', to: '2026-W07' });
  assert.match(invalid.error, /from must be less than or equal to to/i);
});

test('buildInsightsPayload computes core KPIs and chart data', () => {
  const users = [
    { _id: 'u1', name: 'Alice', email: 'alice@example.com' },
    { _id: 'u2', name: 'Bob', email: 'bob@example.com' },
  ];

  const reports = [
    {
      salesmanId: 'u1',
      weekKey: '2026-01-26',
      planningRows: [
        {
          date: '2026-01-26',
          customerName: 'Acme',
          locationArea: 'North',
          customerType: 'targeted_budgeted',
          contactType: 'nc',
        },
        {
          date: '2026-01-27',
          customerName: 'Acme',
          locationArea: 'North',
          customerType: 'targeted_budgeted',
          contactType: 'fc',
        },
      ],
      actualOutputRows: [
        { date: '2026-01-26', visited: 'yes', enquiriesReceived: 2, shipmentsConverted: 0 },
        { date: '2026-01-27', visited: 'yes', enquiriesReceived: 0, shipmentsConverted: 1 },
      ],
    },
    {
      salesmanId: 'u2',
      weekKey: '2026-01-26',
      planningRows: [
        {
          date: '2026-01-28',
          customerName: 'Bravo',
          locationArea: 'South',
          customerType: 'existing',
          contactType: 'jsv',
        },
      ],
      actualOutputRows: [
        { date: '2026-01-28', visited: 'no', enquiriesReceived: 1, shipmentsConverted: 0 },
      ],
    },
  ];

  const payload = buildInsightsPayload({
    users,
    reports,
    range: buildRange('2026-W05', '2026-W07'),
  });

  assert.equal(payload.totals.plannedVisits, 3);
  assert.equal(payload.totals.actualVisits, 2);
  assert.equal(payload.totals.enquiries, 3);
  assert.equal(payload.totals.shipments, 1);

  assert.equal(payload.kpis.visitCompletionRate.numerator, 2);
  assert.equal(payload.kpis.visitCompletionRate.denominator, 3);
  assert.equal(payload.kpis.enquiryToShipmentConversionRate.numerator, 1);
  assert.equal(payload.kpis.enquiryToShipmentConversionRate.denominator, 3);

  assert.equal(payload.kpis.averageDaysEnquiryToShipment, 1);
  assert.equal(payload.kpis.averageDaysEnquiryToShipmentSamples, 1);

  const customerTypeRows = payload.charts.conversionByCustomerType;
  const newRow = customerTypeRows.find((row) => row.customerType === 'New');
  const existingRow = customerTypeRows.find((row) => row.customerType === 'Existing');
  assert.equal(newRow.enquiries, 2);
  assert.equal(newRow.shipments, 1);
  assert.equal(existingRow.enquiries, 1);
  assert.equal(existingRow.shipments, 0);

  const visitTypeRows = payload.charts.conversionByVisitType;
  assert.equal(visitTypeRows.find((row) => row.visitType === 'NC').enquiries, 2);
  assert.equal(visitTypeRows.find((row) => row.visitType === 'FC').shipments, 1);
  assert.equal(visitTypeRows.find((row) => row.visitType === 'JSV').enquiries, 1);

  assert.equal(payload.kpis.mostProductiveDay.day, 'Tuesday');
  assert.equal(payload.tables.locationProductivity.length, 2);
  assert.equal(payload.tables.salespersonProductivity.length, 2);
  assert.equal(payload.tables.customerProductivity.length, 2);

  const acmeRow = payload.tables.customerProductivity.find((row) => row.customer === 'Acme');
  assert.deepEqual(acmeRow, {
    customer: 'Acme',
    plannedVisits: 2,
    actualVisits: 2,
    enquiries: 2,
    shipments: 1,
    completionRate: 1,
    conversionRate: 0.5,
  });

  const bravoRow = payload.tables.customerProductivity.find((row) => row.customer === 'Bravo');
  assert.deepEqual(bravoRow, {
    customer: 'Bravo',
    plannedVisits: 1,
    actualVisits: 0,
    enquiries: 1,
    shipments: 0,
    completionRate: 0,
    conversionRate: 0,
  });
});

test('buildInsightsPayload safely handles zero denominators and no lag samples', () => {
  const users = [{ _id: 'u1', name: 'Alice', email: 'alice@example.com' }];
  const reports = [
    {
      salesmanId: 'u1',
      weekKey: '2026-01-26',
      planningRows: [
        { date: '2026-01-26', customerName: 'Acme', locationArea: 'North', contactType: 'nc' },
      ],
      actualOutputRows: [{ date: '2026-01-26', visited: 'no', enquiriesReceived: 0, shipmentsConverted: 0 }],
    },
  ];

  const payload = buildInsightsPayload({ users, reports, range: buildRange('2026-W05', '2026-W07') });

  assert.equal(payload.kpis.enquiryToShipmentConversionRate.value, 0);
  assert.equal(payload.kpis.enquiriesPerVisit.value, 0);
  assert.equal(payload.kpis.shipmentsPerVisit.value, 0);
  assert.equal(payload.kpis.averageDaysEnquiryToShipment, null);
  assert.equal(payload.notes.length >= 2, true);
  assert.equal(payload.tables.customerProductivity.length, 1);
  assert.equal(payload.tables.customerProductivity[0].conversionRate, 0);
});
