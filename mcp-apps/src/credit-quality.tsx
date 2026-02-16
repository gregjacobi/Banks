import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { COLORS, BASE_STYLES, TOOLTIP_STYLE, AXIS_TICK_STYLE } from './shared/theme';
import { formatValue } from './shared/chart-utils';

interface CreditQualityBucket {
  realEstate?: { total?: number };
  ci?: number;
  consumer?: { total?: number };
  agricultural?: number;
  leases?: number;
  other?: number;
  grandTotal?: number;
}

interface ChargeOffCategory {
  total?: number;
  realEstate?: number;
  ci?: number;
  consumer?: { total?: number } | number;
  agricultural?: number;
  leases?: number;
}

interface FinancialData {
  institution: { name: string; idrssd: string };
  reportingPeriod: string;
  creditQuality?: {
    pastDue30to89?: CreditQualityBucket;
    pastDue90Plus?: CreditQualityBucket;
    nonaccrual?: CreditQualityBucket;
    summary?: {
      totalPastDue30to89?: number;
      totalPastDue90Plus?: number;
      totalNonaccrual?: number;
      totalNonperforming?: number;
    };
  };
  chargeOffsAndRecoveries?: {
    chargeOffs?: ChargeOffCategory;
    recoveries?: ChargeOffCategory;
    netChargeOffs?: { total?: number; realEstate?: number; ci?: number; consumer?: number; agricultural?: number; leases?: number };
  };
}

const DELINQUENCY_COLORS = {
  pastDue30to89: '#D97706',
  pastDue90Plus: '#DC2626',
  nonaccrual: '#7C3AED',
};

const CHART_HEIGHT = 240;
const GRID_PROPS = { strokeDasharray: '3 3', stroke: COLORS.gridLine, vertical: false };

function getBucketValue(bucket: CreditQualityBucket | undefined, key: string): number {
  if (!bucket) return 0;
  switch (key) {
    case 'realEstate': return bucket.realEstate?.total || 0;
    case 'ci': return bucket.ci || 0;
    case 'consumer': return bucket.consumer?.total || 0;
    case 'agricultural': return bucket.agricultural || 0;
    case 'leases': return bucket.leases || 0;
    case 'other': return bucket.other || 0;
    default: return 0;
  }
}

function SummaryCard({ label, value, format }: { label: string; value: number | undefined; format: string }) {
  return (
    <div style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 6,
      padding: '12px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{formatValue(value ?? null, format)}</div>
    </div>
  );
}

function CreditQualityDashboard({ data }: { data: FinancialData }) {
  const cq = data.creditQuality;
  const co = data.chargeOffsAndRecoveries;

  const loanCategories = [
    { key: 'realEstate', label: 'Real Estate' },
    { key: 'ci', label: 'C&I' },
    { key: 'consumer', label: 'Consumer' },
    { key: 'agricultural', label: 'Agricultural' },
    { key: 'leases', label: 'Leases' },
    { key: 'other', label: 'Other' },
  ];

  const delinquencyData = loanCategories.map((cat) => ({
    name: cat.label,
    'Past Due 30-89': getBucketValue(cq?.pastDue30to89, cat.key) / 1e3,
    'Past Due 90+': getBucketValue(cq?.pastDue90Plus, cat.key) / 1e3,
    'Nonaccrual': getBucketValue(cq?.nonaccrual, cat.key) / 1e3,
  }));

  const getConsumerTotal = (cat: ChargeOffCategory | undefined): number => {
    if (!cat) return 0;
    if (typeof cat.consumer === 'number') return cat.consumer;
    return cat.consumer?.total || 0;
  };

  const chargeOffCategories = [
    { key: 'realEstate', label: 'Real Estate' },
    { key: 'ci', label: 'C&I' },
    { key: 'consumer', label: 'Consumer' },
    { key: 'agricultural', label: 'Agricultural' },
    { key: 'leases', label: 'Leases' },
  ];

  const chargeOffData = chargeOffCategories.map((cat) => {
    let chargeOff = 0;
    let recovery = 0;
    if (cat.key === 'consumer') {
      chargeOff = getConsumerTotal(co?.chargeOffs);
      recovery = getConsumerTotal(co?.recoveries);
    } else {
      chargeOff = (co?.chargeOffs as Record<string, number>)?.[cat.key] || 0;
      recovery = (co?.recoveries as Record<string, number>)?.[cat.key] || 0;
    }
    return {
      name: cat.label,
      'Charge-Offs': chargeOff / 1e3,
      'Recoveries': recovery / 1e3,
    };
  });

  return (
    <div style={BASE_STYLES.container}>
      <h1 style={BASE_STYLES.title}>{data.institution.name}</h1>
      <p style={BASE_STYLES.subtitle}>Credit Quality Dashboard | {data.reportingPeriod}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
        <SummaryCard label="Past Due 30-89" value={cq?.summary?.totalPastDue30to89 ? cq.summary.totalPastDue30to89 / 1e3 : undefined} format="currency" />
        <SummaryCard label="Past Due 90+" value={cq?.summary?.totalPastDue90Plus ? cq.summary.totalPastDue90Plus / 1e3 : undefined} format="currency" />
        <SummaryCard label="Nonaccrual" value={cq?.summary?.totalNonaccrual ? cq.summary.totalNonaccrual / 1e3 : undefined} format="currency" />
        <SummaryCard label="Total Nonperforming" value={cq?.summary?.totalNonperforming ? cq.summary.totalNonperforming / 1e3 : undefined} format="currency" />
        <SummaryCard label="Net Charge-Offs" value={co?.netChargeOffs?.total ? co.netChargeOffs.total / 1e3 : undefined} format="currency" />
      </div>

      <div style={BASE_STYLES.chartContainer}>
        <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>Delinquency by Loan Category ($K)</h3>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={delinquencyData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: COLORS.border }} />
            <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}K`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v.toFixed(0)}K`} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Bar dataKey="Past Due 30-89" stackId="delinq" fill={DELINQUENCY_COLORS.pastDue30to89} />
            <Bar dataKey="Past Due 90+" stackId="delinq" fill={DELINQUENCY_COLORS.pastDue90Plus} />
            <Bar dataKey="Nonaccrual" stackId="delinq" fill={DELINQUENCY_COLORS.nonaccrual} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={BASE_STYLES.chartContainer}>
        <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>Charge-Offs vs Recoveries by Category ($K)</h3>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={chargeOffData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" tick={AXIS_TICK_STYLE} tickLine={false} axisLine={{ stroke: COLORS.border }} />
            <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}K`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `$${v.toFixed(0)}K`} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Bar dataKey="Charge-Offs" fill={COLORS.danger} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Recoveries" fill={COLORS.success} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AppRoot() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const app = new App({ name: 'Credit Quality', version: '1.0.0' });

    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text;
        if (!text) { setError('No data received'); return; }
        const parsed = JSON.parse(text) as FinancialData;
        if (!parsed.institution || !parsed.creditQuality) {
          setError('Invalid data: missing institution or credit quality data');
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
          <p style={{ fontSize: 13 }}>Loading credit quality data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return <CreditQualityDashboard data={data} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppRoot />);
