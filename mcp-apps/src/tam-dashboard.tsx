import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { COLORS, BASE_STYLES, TOOLTIP_STYLE, AXIS_TICK_STYLE } from './shared/theme';
import { formatValue } from './shared/chart-utils';

interface TAMData {
  bankName: string;
  idrssd: string;
  tier: string;
  tam: {
    claudeCode: number;
    claudeEnterprise: number;
    agentsRunBusiness: number;
    agentsGrowBusiness: number;
    total: number;
  };
  tamBreakdown: Record<string, number>;
  penetrationByProduct?: Record<string, Record<string, number>>;
  quarterlyRevenue?: Record<string, Record<string, { revenue: number }>>;
  threeYearAchievable: number;
  inputs: {
    totalRevenue: number;
    annualRevenue: number;
    totalAssets: number;
  };
}

const PRODUCT_COLORS: Record<string, string> = {
  claudeCode: COLORS.chart[0],
  claudeEnterprise: COLORS.chart[1],
  agentsRunBusiness: COLORS.chart[2],
  agentsGrowBusiness: COLORS.chart[3],
};

const PRODUCT_LABELS: Record<string, string> = {
  claudeCode: 'Claude Code',
  claudeEnterprise: 'Claude Enterprise',
  agentsRunBusiness: 'Agents (Run)',
  agentsGrowBusiness: 'Agents (Grow)',
};

const CHART_HEIGHT = 260;
const GRID_PROPS = { strokeDasharray: '3 3', stroke: COLORS.gridLine, vertical: false };

function SummaryCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '12px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.primary }}>{value}</div>
      {sublabel && <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{sublabel}</div>}
    </div>
  );
}

function PenetrationBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value * 100, 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
        <span style={{ color: COLORS.text }}>{label}</span>
        <span style={{ color: COLORS.textSecondary, fontWeight: 600 }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          backgroundColor: COLORS.primary,
          borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  );
}

function TAMDashboard({ data }: { data: TAMData }) {
  const products = ['claudeCode', 'claudeEnterprise', 'agentsRunBusiness', 'agentsGrowBusiness'];

  // Build quarterly revenue timeline
  const quarterlyData: { quarter: string; [key: string]: number | string }[] = [];
  if (data.quarterlyRevenue) {
    const quarters = Object.keys(data.quarterlyRevenue).sort();
    for (const q of quarters) {
      const qData = data.quarterlyRevenue[q];
      const point: Record<string, number | string> = { quarter: q };
      let total = 0;
      for (const product of products) {
        const rev = qData?.[product]?.revenue || 0;
        point[product] = rev / 1e3; // Convert to $K
        total += rev / 1e3;
      }
      point['total'] = total;
      quarterlyData.push(point);
    }
  }

  // TAM breakdown data for bar chart
  const tamBreakdownData = products.map((p) => ({
    name: PRODUCT_LABELS[p],
    TAM: (data.tam[p as keyof typeof data.tam] || 0) / 1e3,
    color: PRODUCT_COLORS[p],
  }));

  // Penetration data
  const penetrationEntries: { label: string; value: number }[] = [];
  if (data.penetrationByProduct) {
    for (const [product, segments] of Object.entries(data.penetrationByProduct)) {
      if (typeof segments === 'object' && segments) {
        for (const [segment, value] of Object.entries(segments)) {
          if (typeof value === 'number') {
            penetrationEntries.push({
              label: `${PRODUCT_LABELS[product] || product} - ${segment}`,
              value,
            });
          }
        }
      }
    }
  }

  return (
    <div style={BASE_STYLES.container}>
      <h1 style={BASE_STYLES.title}>{data.bankName}</h1>
      <p style={BASE_STYLES.subtitle}>TAM Analysis | Tier: {data.tier} | {data.idrssd}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 16 }}>
        <SummaryCard label="Total TAM" value={formatValue(data.tam.total, 'currency')} />
        <SummaryCard label="3-Year Achievable" value={formatValue(data.threeYearAchievable, 'currency')} />
        <SummaryCard label="Annual Revenue" value={formatValue(data.inputs.annualRevenue, 'currency')} sublabel="Current" />
        <SummaryCard label="Total Assets" value={formatValue(data.inputs.totalAssets, 'currency')} />
      </div>

      <div style={BASE_STYLES.chartContainer}>
        <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>TAM by Product ($K)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tamBreakdownData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: COLORS.border }} />
            <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}K`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v.toFixed(1)}K`} />
            <Bar dataKey="TAM" radius={[4, 4, 0, 0]}>
              {tamBreakdownData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {quarterlyData.length > 0 && (
        <div style={BASE_STYLES.chartContainer}>
          <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>Revenue Projections by Quarter ($K)</h3>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <AreaChart data={quarterlyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="quarter" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: COLORS.border }} />
              <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}K`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v.toFixed(1)}K`} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
              {products.map((p) => (
                <Area
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={PRODUCT_LABELS[p]}
                  stroke={PRODUCT_COLORS[p]}
                  fill={PRODUCT_COLORS[p]}
                  fillOpacity={0.3}
                  stackId="revenue"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {penetrationEntries.length > 0 && (
        <div style={BASE_STYLES.chartContainer}>
          <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>Penetration Targets</h3>
          {penetrationEntries.map((entry) => (
            <PenetrationBar key={entry.label} label={entry.label} value={entry.value} />
          ))}
        </div>
      )}
    </div>
  );
}

function AppRoot() {
  const [data, setData] = useState<TAMData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const app = new App({ name: 'TAM Dashboard', version: '1.0.0' });

    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text;
        if (!text) { setError('No data received'); return; }
        const parsed = JSON.parse(text) as TAMData;
        if (!parsed.tam) {
          setError('Invalid data: missing TAM data');
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
          <p style={{ fontSize: 13 }}>Loading TAM data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return <TAMDashboard data={data} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppRoot />);
