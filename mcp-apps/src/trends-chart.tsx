import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { COLORS, BASE_STYLES, TOOLTIP_STYLE, AXIS_TICK_STYLE } from './shared/theme';
import { formatValue, formatPeriodLabel } from './shared/chart-utils';

interface TimeSeriesPoint {
  period: string;
  totalAssets?: number;
  totalLoans?: number;
  totalDeposits?: number;
  totalEquity?: number;
  netIncome?: number;
  netInterestIncome?: number;
  nim?: number;
  roa?: number;
  roe?: number;
  efficiencyRatio?: number;
  operatingLeverage?: number;
  tier1LeverageRatio?: number;
  nonperformingTotal?: number;
  netChargeOffs?: number;
}

interface TrendsData {
  bankName: string;
  idrssd: string;
  periodCount: number;
  series: TimeSeriesPoint[];
}

const GRID_PROPS = { strokeDasharray: '3 3', stroke: COLORS.gridLine, vertical: false };
const CHART_HEIGHT = 220;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={BASE_STYLES.chartContainer}>
      <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>{title}</h3>
      {children}
    </div>
  );
}

function TrendsCharts({ data }: { data: TrendsData }) {
  const chartData = data.series.map((p) => ({
    ...p,
    label: formatPeriodLabel(p.period),
    totalAssetsM: p.totalAssets ? p.totalAssets / 1e6 : null,
    totalLoansM: p.totalLoans ? p.totalLoans / 1e6 : null,
    totalDepositsM: p.totalDeposits ? p.totalDeposits / 1e6 : null,
    netChargeOffsM: p.netChargeOffs ? p.netChargeOffs / 1e6 : null,
    nonperformingM: p.nonperformingTotal ? p.nonperformingTotal / 1e6 : null,
  }));

  const xAxisProps = {
    dataKey: 'label' as const,
    tick: AXIS_TICK_STYLE,
    tickLine: false,
    axisLine: { stroke: COLORS.border },
  };

  const yAxisProps = (format: string) => ({
    tick: AXIS_TICK_STYLE,
    tickLine: false,
    axisLine: false,
    tickFormatter: (v: number) => formatValue(v, format),
  });

  const periodRange = chartData.length > 0
    ? `${chartData[0].label} - ${chartData[chartData.length - 1].label}`
    : '';

  return (
    <div style={BASE_STYLES.container}>
      <h1 style={BASE_STYLES.title}>{data.bankName}</h1>
      <p style={BASE_STYLES.subtitle}>Financial Trends | {periodRange} | {data.periodCount} quarters</p>

      <Section title="Balance Sheet Trends ($M)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps('number')} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v.toFixed(0)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Area type="monotone" dataKey="totalAssetsM" name="Total Assets" stroke={COLORS.chart[0]} fill={COLORS.chart[0]} fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="totalLoansM" name="Net Loans" stroke={COLORS.chart[1]} fill={COLORS.chart[1]} fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="totalDepositsM" name="Total Deposits" stroke={COLORS.chart[2]} fill={COLORS.chart[2]} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Profitability Ratios (%)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps('percent')} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Line type="monotone" dataKey="nim" name="Net Interest Margin" stroke={COLORS.chart[0]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
            <Line type="monotone" dataKey="roa" name="ROA" stroke={COLORS.chart[1]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
            <Line type="monotone" dataKey="roe" name="ROE" stroke={COLORS.chart[2]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Efficiency & Operating Leverage">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis yAxisId="left" {...yAxisProps('percent')} />
            <YAxis yAxisId="right" orientation="right" {...yAxisProps('ratio')} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, name: string) =>
                name === 'Operating Leverage' ? `${v.toFixed(2)}x` : `${v.toFixed(1)}%`
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Line yAxisId="left" type="monotone" dataKey="efficiencyRatio" name="Efficiency Ratio (lower is better)" stroke={COLORS.chart[3]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
            <Line yAxisId="right" type="monotone" dataKey="operatingLeverage" name="Operating Leverage" stroke={COLORS.chart[4]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Credit Quality ($M)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps('number')} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v.toFixed(1)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Bar dataKey="nonperformingM" name="Nonperforming" fill={COLORS.chart[5]} radius={[2, 2, 0, 0]} />
            <Bar dataKey="netChargeOffsM" name="Net Charge-Offs" fill={COLORS.chart[3]} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title="Capital Adequacy (%)">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps('percent')} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v.toFixed(2)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Line type="monotone" dataKey="tier1LeverageRatio" name="Tier 1 Leverage Ratio" stroke={COLORS.chart[6]} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Section>
    </div>
  );
}

function AppRoot() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const app = new App({ name: 'Financial Trends', version: '1.0.0' });

    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text;
        if (!text) { setError('No data received'); return; }
        const parsed = JSON.parse(text) as TrendsData;
        if (!parsed.series || !Array.isArray(parsed.series)) {
          setError('Invalid data: missing series array');
          return;
        }
        setData(parsed);
        setError(null);
      } catch (e) {
        setError(`Failed to parse data: ${e instanceof Error ? e.message : String(e)}`);
      }
    };

    app.connect();
  }, []);

  if (error) {
    return (
      <div style={{ ...BASE_STYLES.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...BASE_STYLES.card, textAlign: 'center', color: COLORS.danger }}>
          <p style={{ fontWeight: 600 }}>Error</p>
          <p style={{ fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ ...BASE_STYLES.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: COLORS.textSecondary }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${COLORS.border}`,
            borderTopColor: COLORS.primary, borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 13 }}>Loading financial trends...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return <TrendsCharts data={data} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppRoot />);
