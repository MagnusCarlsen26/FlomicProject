import DataTableFrame from '../ui/DataTableFrame'

function formatPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

export default function SalespersonProductivityTable({ rows }) {
  if (!rows?.length) {
    return <p className="rounded-xl border border-dashed border-border p-3 text-sm text-text-secondary">No salesperson data</p>
  }

  return (
    <DataTableFrame>
      <table className="table-core min-w-full text-sm">
        <thead>
          <tr>
            <th>Salesperson</th>
            <th>Planned</th>
            <th>Actual</th>
            <th>Avg visits/week</th>
            <th>Enquiries</th>
            <th>Shipments</th>
            <th>Completion</th>
            <th>Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name || row.email}</td>
              <td>{row.plannedVisits}</td>
              <td>{row.actualVisits}</td>
              <td>{row.averageVisitsPerWeek.toFixed(2)}</td>
              <td>{row.enquiries}</td>
              <td>{row.shipments}</td>
              <td>{formatPercent(row.completionRate)}</td>
              <td>{formatPercent(row.conversionRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableFrame>
  )
}
