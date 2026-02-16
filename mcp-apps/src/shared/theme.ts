export const COLORS = {
  primary: '#D97757',
  primaryLight: '#E8956F',
  primaryDark: '#C45E3F',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#2E7D32',
  warning: '#ED6C02',
  danger: '#D32F2F',
  peerGray: '#BDBDBD',
  peerAvgLine: '#999999',
  gridLine: '#F0F0F0',
  chart: [
    '#D97757', '#4F46E5', '#059669', '#D97706',
    '#7C3AED', '#DC2626', '#0891B2', '#65A30D',
  ],
};

export const FONTS = {
  primary: '"Styrene A", system-ui, -apple-system, sans-serif',
  mono: '"SF Mono", "Fira Code", "Consolas", monospace',
};

export const CHART_DEFAULTS = {
  margin: { top: 20, right: 30, left: 20, bottom: 5 },
  height: 400,
  animationDuration: 300,
};

export const BASE_STYLES: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: FONTS.primary,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    padding: 16,
    minHeight: '100vh',
    boxSizing: 'border-box' as const,
  },
  card: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: COLORS.text,
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    margin: 0,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: COLORS.text,
    margin: 0,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: `2px solid ${COLORS.text}`,
  },
  chartContainer: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
};

export const TOOLTIP_STYLE: React.CSSProperties = {
  fontSize: 12,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  backgroundColor: COLORS.surface,
};

export const AXIS_TICK_STYLE = {
  fontSize: 10,
  fill: COLORS.textSecondary,
};
