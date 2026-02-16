import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ScatterChart, Scatter, PieChart, Pie, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { COLORS, FONTS, CHART_DEFAULTS, BASE_STYLES, TOOLTIP_STYLE, AXIS_TICK_STYLE } from './shared/theme';
import { formatValue, getChartColor } from './shared/chart-utils';

interface SeriesSpec {
  key: string;
  name: string;
  color?: string;
  type?: 'line' | 'bar' | 'area';
}

interface ChartSpec {
  title: string;
  subtitle?: string;
  chartType: 'line' | 'bar' | 'area' | 'scatter' | 'pie' | 'composed';
  data: Record<string, unknown>[];
  series: SeriesSpec[];
  xAxis: { key: string; label?: string };
  yAxis?: { label?: string; format?: 'percent' | 'currency' | 'number' | 'ratio' };
  stacked?: boolean;
  height?: number;
}

const PIE_COLORS = COLORS.chart;

function formatTick(value: unknown, format?: string): string {
  if (typeof value !== 'number') return String(value ?? '');
  return formatValue(value, format || 'number');
}

function DynamicChart({ spec }: { spec: ChartSpec }) {
  const height = spec.height || CHART_DEFAULTS.height;
  const yFormat = spec.yAxis?.format || 'number';

  const tooltipFormatter = (value: unknown) => {
    if (typeof value === 'number') return formatTick(value, yFormat);
    return String(value ?? '');
  };

  const renderChart = () => {
    const commonProps = {
      data: spec.data,
      margin: CHART_DEFAULTS.margin,
    };

    const xAxisProps = {
      dataKey: spec.xAxis.key,
      tick: AXIS_TICK_STYLE,
      tickLine: false,
      axisLine: { stroke: COLORS.border },
    };

    const yAxisProps = {
      tick: AXIS_TICK_STYLE,
      tickLine: false,
      axisLine: false,
      tickFormatter: (v: number) => formatTick(v, yFormat),
      label: spec.yAxis?.label ? {
        value: spec.yAxis.label,
        angle: -90,
        position: 'insideLeft' as const,
        style: { fontSize: 11, fill: COLORS.textSecondary },
      } : undefined,
    };

    const gridProps = {
      strokeDasharray: '3 3',
      stroke: COLORS.gridLine,
      vertical: false,
    };

    switch (spec.chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            {spec.series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color || getChartColor(i)}
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            {spec.series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color || getChartColor(i)}
                stackId={spec.stacked ? 'stack' : undefined}
                radius={spec.stacked ? undefined : [2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            {spec.series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color || getChartColor(i)}
                fill={s.color || getChartColor(i)}
                fillOpacity={0.3}
                stackId={spec.stacked ? 'stack' : undefined}
              />
            ))}
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} type="number" />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            {spec.series.map((s, i) => (
              <Scatter
                key={s.key}
                name={s.name}
                dataKey={s.key}
                fill={s.color || getChartColor(i)}
              />
            ))}
          </ScatterChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            <Pie
              data={spec.data}
              dataKey={spec.series[0]?.key || 'value'}
              nameKey={spec.xAxis.key}
              cx="50%"
              cy="50%"
              outerRadius="70%"
              label={({ name, value }) => `${name}: ${formatTick(value, yFormat)}`}
              labelLine={true}
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
            {spec.series.map((s, i) => {
              const color = s.color || getChartColor(i);
              switch (s.type) {
                case 'bar':
                  return <Bar key={s.key} dataKey={s.key} name={s.name} fill={color} radius={[2, 2, 0, 0]} />;
                case 'area':
                  return <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} fill={color} fillOpacity={0.3} />;
                default:
                  return <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} />;
              }
            })}
          </ComposedChart>
        );

      default:
        return <div style={{ padding: 20, color: COLORS.danger }}>Unsupported chart type: {spec.chartType}</div>;
    }
  };

  return (
    <div style={BASE_STYLES.container}>
      <h1 style={BASE_STYLES.title}>{spec.title}</h1>
      {spec.subtitle && <p style={BASE_STYLES.subtitle}>{spec.subtitle}</p>}
      <div style={BASE_STYLES.card}>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AppRoot() {
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const app = new App({ name: 'Dynamic Chart', version: '1.0.0' });

    app.ontoolresult = (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text;
        if (!text) {
          setError('No chart data received');
          return;
        }
        const parsed = JSON.parse(text) as ChartSpec;
        if (!parsed.chartType || !parsed.data || !parsed.series) {
          setError('Invalid chart spec: missing chartType, data, or series');
          return;
        }
        setSpec(parsed);
        setError(null);
      } catch (e) {
        setError(`Failed to parse chart data: ${e instanceof Error ? e.message : String(e)}`);
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

  if (!spec) {
    return (
      <div style={{ ...BASE_STYLES.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: COLORS.textSecondary }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${COLORS.border}`,
            borderTopColor: COLORS.primary, borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 13 }}>Waiting for chart data...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return <DynamicChart spec={spec} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppRoot />);
