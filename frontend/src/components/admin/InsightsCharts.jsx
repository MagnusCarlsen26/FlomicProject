import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PIE_COLORS = ['#1d4ed8', '#0f766e', '#7c3aed', '#c2410c']

function ChartPanel({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      <div className="mt-3 h-72">{children}</div>
    </div>
  )
}

export default function InsightsCharts({ charts }) {
  const actualVsPlanned = (charts?.actualVsPlannedBySalesperson || []).filter(
    (row) => (row?.plannedVisits || 0) > 0 || (row?.actualVisits || 0) > 0,
  )
  const contactDistribution = charts?.contactTypeDistribution || []
  const conversionByCustomerType = charts?.conversionByCustomerType || []
  const conversionByVisitType = charts?.conversionByVisitType || []
  const productivityByWeekday = charts?.productivityByWeekday || []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Actual vs Planned Visits by Salesperson">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={actualVsPlanned} layout="vertical" margin={{ top: 8, right: 8, left: 12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="salesperson" width={160} />
              <Tooltip />
              <Legend />
              <Bar dataKey="plannedVisits" fill="#64748b" name="Planned" />
              <Bar dataKey="actualVisits" fill="#0f766e" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="NC / FC / SC / JSV Distribution">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={contactDistribution} dataKey="count" nameKey="type" outerRadius={100} label>
                {contactDistribution.map((entry, index) => (
                  <Cell key={entry.type} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel title="Conversion by Customer Type">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conversionByCustomerType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="customerType" />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
              <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
              <Bar dataKey="conversionRate" fill="#1d4ed8" name="Conversion Rate" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Conversion by Visit Type">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conversionByVisitType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="visitType" />
              <YAxis domain={[0, 1]} tickFormatter={(value) => `${Math.round(value * 100)}%`} />
              <Tooltip formatter={(value) => `${(value * 100).toFixed(1)}%`} />
              <Bar dataKey="conversionRate" fill="#7c3aed" name="Conversion Rate" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <div className="grid gap-4">
        <ChartPanel title="Productivity by Day of Week">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={productivityByWeekday}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="enquiries" fill="#0369a1" name="Enquiries" />
              <Bar dataKey="shipments" fill="#0f766e" name="Shipments" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>
    </div>
  )
}
