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
import RevealCard from '../motion/RevealCard'
import { useTheme } from '../../context/useTheme'
import { getChartTheme } from '../../themeTokens'

function ChartPanel({ title, children }) {
  return (
    <RevealCard className="glass-card rounded-3xl p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
      <div className="mt-3 h-72">{children}</div>
    </RevealCard>
  )
}

function ChartGroup({ title, description, children }) {
  return (
    <section className="space-y-3 rounded-3xl border border-border bg-surface-muted/60 p-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export default function InsightsCharts({ charts }) {
  const { resolvedTheme } = useTheme()
  const chartTheme = getChartTheme(resolvedTheme)

  const contactDistribution = charts?.contactTypeDistribution || []
  const conversionByCustomerType = charts?.conversionByCustomerType || []
  const conversionByVisitType = charts?.conversionByVisitType || []
  const productivityByWeekday = charts?.productivityByWeekday || []

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    color: chartTheme.tooltipText,
    border: `1px solid ${chartTheme.grid}`,
    borderRadius: '0.85rem',
    fontSize: '12px',
  }

  return (
    <div className="space-y-5">
      <ChartGroup title="Execution Tracking">
        <div className="grid gap-4">
          <ChartPanel title="Productivity by Day of Week">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityByWeekday}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: chartTheme.axis }} />
                <YAxis allowDecimals={false} tick={{ fill: chartTheme.axis }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="enquiries" fill={chartTheme.enquiries} name="Enquiries" />
                <Bar dataKey="shipments" fill={chartTheme.shipments} name="Shipments" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      </ChartGroup>

      <ChartGroup title="Conversion & Mix">
        <div className="grid gap-4 xl:grid-cols-3">
          <ChartPanel title="Conversion by Customer Type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionByCustomerType}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="customerType" tick={{ fill: chartTheme.axis }} />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: chartTheme.axis }}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                <Bar dataKey="conversionRate" fill={chartTheme.conversionA} name="Conversion Rate" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Conversion by Visit Type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversionByVisitType}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                <XAxis dataKey="visitType" tick={{ fill: chartTheme.axis }} />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fill: chartTheme.axis }}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${(value * 100).toFixed(1)}%`} />
                <Bar dataKey="conversionRate" fill={chartTheme.conversionB} name="Conversion Rate" />
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="NC / FC / SC / JSV Distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={contactDistribution} dataKey="count" nameKey="type" outerRadius={100} label>
                  {contactDistribution.map((entry, index) => (
                    <Cell key={entry.type} fill={chartTheme.pie[index % chartTheme.pie.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      </ChartGroup>
    </div>
  )
}
