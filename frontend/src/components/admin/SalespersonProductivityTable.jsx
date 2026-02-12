function formatPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

export default function SalespersonProductivityTable({ rows }) {
  if (!rows?.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">No salesperson data</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Salesperson</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Planned</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Actual</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Avg visits/week</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Enquiries</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Shipments</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Completion</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Conversion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 text-slate-900">{row.name || row.email}</td>
              <td className="px-3 py-2 text-slate-700">{row.plannedVisits}</td>
              <td className="px-3 py-2 text-slate-700">{row.actualVisits}</td>
              <td className="px-3 py-2 text-slate-700">{row.averageVisitsPerWeek.toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-700">{row.enquiries}</td>
              <td className="px-3 py-2 text-slate-700">{row.shipments}</td>
              <td className="px-3 py-2 text-slate-700">{formatPercent(row.completionRate)}</td>
              <td className="px-3 py-2 text-slate-700">{formatPercent(row.conversionRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
