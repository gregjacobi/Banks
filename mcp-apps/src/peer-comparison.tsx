import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { COLORS, BASE_STYLES, TOOLTIP_STYLE, AXIS_TICK_STYLE } from './shared/theme';
import { formatValue, getPercentileColor } from './shared/chart-utils';

interface BankData {
  idrssd: string;
  name: string;
  isTarget: boolean;
  totalAssets?: number;
  efficiencyRatio?: number;
  roa?: number;
  roe?: number;
  nim?: number;
  operatingLeverage?: number;
  tier1LeverageRatio?: number;
}

interface PeerData {
  period: string;
  targetBank: string;
  peerAverages?: Record<string, number>;
  rankings?: Record<string, { rank: number; total: number; percentile: number }>;
  banks: BankData[];
}

interface MetricConfig {
  key: keyof BankData;
  label: string;
  format: string;
  lowerBetter: boolean;
  decimals: number;
}

const METRICS: MetricConfig[] = [
  { key: 'roa', label: 'Return on Assets', format: 'percent', lowerBetter: false, decimals: 2 },
  { key: 'roe', label: 'Return on Equity', format: 'percent', lowerBetter: false, decimals: 1 },
  { key: 'nim', label: 'Net Interest Margin', format: 'percent', lowerBetter: false, decimals: 2 },
  { key: 'efficiencyRatio', label: 'Efficiency Ratio', format: 'percent', lowerBetter: true, decimals: 1 },
  { key: 'operatingLeverage', label: 'Operating Leverage', format: 'ratio', lowerBetter: false, decimals: 2 },
  { key: 'tier1LeverageRatio', label: 'Tier 1 Leverage', format: 'percent', lowerBetter: false, decimals: 2 },
];

const GRID_PROPS = { strokeDasharray: '3 3', stroke: COLORS.gridLine, vertical: false };

function MetricChart({ metric, banks, peerAvg, ranking }: {
  metric: MetricConfig;
  banks: BankData[];
  peerAvg?: number;
  ranking?: { rank: number; total: number; percentile: number };
}) {
  const sorted = banks
    .filter((b) => b[metric.key] != null)
    .map((b) => ({
      name: b.name,
      value: b[metric.key] as number,
      isTarget: b.isTarget,
    }))
    .sort((a, b) => metric.lowerBetter ? (b.value - a.value) : (a.value - b.value));

  const targetBank = sorted.find((b) => b.isTarget);
  const targetValue = targetBank?.value;

  return (
    <div style={BASE_STYLES.chartContainer}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
            {metric.label}
            {metric.lowerBetter && <span style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 6 }}>(lower is better)</span>}
          </h3>
          <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
            <span style={{ color: COLORS.primary, fontWeight: 600 }}>
              {targetValue != null ? formatValue(targetValue, metric.format) : '--'}
            </span>
            {peerAvg != null && <span style={{ marginLeft: 8 }}>Peer Avg: {formatValue(peerAvg, metric.format)}</span>}
          </div>
        </div>
        {ranking && (
          <div style={{
            backgroundColor: getPercentileColor(ranking.percentile, metric.lowerBetter),
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            #{ranking.rank}/{ranking.total} ({ranking.percentile}th pctl)
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={sorted} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="name" tick={{ fontSize: 0 }} tickLine={false} axisLine={{ stroke: COLORS.border }} />
          <YAxis tick={AXIS_TICK_STYLE} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatValue(v, metric.format)} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number) => formatValue(v, metric.format)}
            labelFormatter={(label: string) => label}
          />
          {peerAvg != null && (
            <ReferenceLine
              y={peerAvg}
              stroke={COLORS.peerAvgLine}
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ value: `Avg: ${formatValue(peerAvg, metric.format)}`, position: 'right', style: { fontSize: 9, fill: COLORS.textSecondary } }}
            />
          )}
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={entry.isTarget ? COLORS.primary : COLORS.peerGray} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PeerTable({ banks }: { banks: BankData[] }) {
  const sorted = [...banks].sort((a, b) => (b.totalAssets || 0) - (a.totalAssets || 0));

  const cellStyle: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: 11,
    borderBottom: `1px solid ${COLORS.borderLight}`,
    fontFamily: COLORS.text,
  };
  const headerStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    backgroundColor: COLORS.borderLight,
    position: 'sticky' as const,
    top: 0,
  };

  return (
    <div style={{ ...BASE_STYLES.chartContainer, maxHeight: 300, overflowY: 'auto' }}>
      <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 13 }}>Peer Banks</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headerStyle}>Bank</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Assets</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>ROA</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>ROE</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>NIM</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Eff. Ratio</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => (
            <tr key={b.idrssd} style={{ backgroundColor: b.isTarget ? '#FEF3E8' : 'transparent' }}>
              <td style={{ ...cellStyle, fontWeight: b.isTarget ? 700 : 400 }}>
                {b.name}{b.isTarget ? ' (Target)' : ''}
              </td>
              <td style={{ ...cellStyle, textAlign: 'right', fontFamily: '"SF Mono", monospace' }}>{formatValue(b.totalAssets || 0, 'currency')}</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontFamily: '"SF Mono", monospace' }}>{formatValue(b.roa ?? null, 'percent')}</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontFamily: '"SF Mono", monospace' }}>{formatValue(b.roe ?? null, 'percent')}</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontFamily: '"SF Mono", monospace' }}>{formatValue(b.nim ?? null, 'percent')}</td>
              <td style={{ ...cellStyle, textAlign: 'right', fontFamily: '"SF Mono", monospace' }}>{formatValue(b.efficiencyRatio ?? null, 'percent')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeerComparison({ data }: { data: PeerData }) {
  const targetBankData = data.banks.find((b) => b.isTarget);
  const targetName = targetBankData?.name || data.targetBank;
  const peerCount = data.banks.filter((b) => !b.isTarget).length;

  return (
    <div style={BASE_STYLES.container}>
      <h1 style={BASE_STYLES.title}>{targetName}</h1>
      <p style={BASE_STYLES.subtitle}>Peer Comparison vs {peerCount} Peers | {data.period}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 12 }}>
        {METRICS.map((metric) => {
          const peerAvgKey = metric.key === 'nim' ? 'netInterestMargin' : metric.key;
          const peerAvg = data.peerAverages?.[peerAvgKey as string];
          const ranking = data.rankings?.[peerAvgKey as string];
          return (
            <MetricChart
              key={metric.key}
              metric={metric}
              banks={data.banks}
              peerAvg={peerAvg}
              ranking={ranking}
            />
          );
        })}
      </div>

      <PeerTable banks={data.banks} />
    </div>
  );
}

function AppRoot() {
  const [data, setData] = useState<PeerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const app = new App({ name: 'Peer Comparison', version: '1.0.0' });

    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text;
        if (!text) { setError('No data received'); return; }
        const parsed = JSON.parse(text) as PeerData;
        if (!parsed.banks || !Array.isArray(parsed.banks)) {
          setError('Invalid data: missing banks array');
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
          <p style={{ fontSize: 13 }}>Loading peer comparison...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return <PeerComparison data={data} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppRoot />);
