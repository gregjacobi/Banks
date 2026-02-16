/**
 * Server-side chart renderer using Chart.js + node-canvas.
 * Takes a chart spec (same JSON the render-chart tool accepts)
 * and returns a base64-encoded PNG image.
 */
const { createCanvas } = require('canvas');
const { Chart, registerables } = require('chart.js');

// Register all Chart.js components once
Chart.register(...registerables);

// Anthropic brand colors matching the MCP Apps theme
const COLORS = [
  '#D97757', '#4F46E5', '#059669', '#D97706',
  '#7C3AED', '#DC2626', '#0891B2', '#65A30D',
];

/**
 * Map our chart spec types to Chart.js types
 */
function mapChartType(type) {
  const map = {
    line: 'line',
    bar: 'bar',
    area: 'line',      // Chart.js line with fill
    scatter: 'scatter',
    pie: 'pie',
    composed: 'bar',   // Mixed types handled per-dataset
  };
  return map[type] || 'line';
}

/**
 * Format a number for display on axes/tooltips
 */
function formatValue(value, format) {
  if (value == null || isNaN(value)) return '';
  switch (format) {
    case 'percent':
      return `${value.toFixed(2)}%`;
    case 'currency':
      if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
      return `$${value.toFixed(0)}`;
    case 'ratio':
      return `${value.toFixed(2)}x`;
    default:
      return value.toLocaleString();
  }
}

/**
 * Render a chart to a base64 PNG string.
 *
 * @param {Object} spec - Chart specification
 * @param {string} spec.title - Chart title
 * @param {string} spec.chartType - line|bar|area|scatter|pie|composed
 * @param {Array} spec.data - Array of data point objects
 * @param {Array} spec.series - Array of {key, name, color?, type?}
 * @param {Object} spec.xAxis - {key, label}
 * @param {Object} spec.yAxis - {label, format?}
 * @param {boolean} [spec.stacked] - Stack series
 * @param {number} [spec.height] - Chart height (default 400)
 * @returns {string} base64-encoded PNG
 */
function renderChart(spec) {
  const width = 900;
  const height = spec.height || 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const labels = spec.data.map(d => d[spec.xAxis.key]);
  const yFormat = spec.yAxis?.format || 'number';

  // Build datasets
  const datasets = spec.series.map((s, i) => {
    const color = s.color || COLORS[i % COLORS.length];
    const values = spec.data.map(d => d[s.key] ?? null);

    const dataset = {
      label: s.name,
      data: values,
      borderColor: color,
      backgroundColor: spec.chartType === 'pie'
        ? spec.data.map((_, j) => COLORS[j % COLORS.length] + 'CC')
        : color + '40',
      borderWidth: 2,
      pointRadius: spec.chartType === 'scatter' ? 4 : 3,
      pointBackgroundColor: color,
      tension: 0.3,
    };

    // Area charts: fill under line
    if (spec.chartType === 'area' || s.type === 'area') {
      dataset.fill = true;
    }

    // Composed: per-series type override
    if (spec.chartType === 'composed' && s.type) {
      dataset.type = s.type === 'area' ? 'line' : s.type;
      if (s.type === 'area') dataset.fill = true;
    }

    // Bar chart styling
    if (spec.chartType === 'bar' || s.type === 'bar') {
      dataset.backgroundColor = color + 'CC';
      dataset.borderRadius = 3;
    }

    return dataset;
  });

  // Stacking
  if (spec.stacked) {
    datasets.forEach(ds => {
      ds.stack = 'stack0';
    });
  }

  // Chart.js config
  const config = {
    type: mapChartType(spec.chartType),
    data: {
      labels,
      datasets,
    },
    options: {
      responsive: false,
      animation: false,
      devicePixelRatio: 2,
      plugins: {
        title: {
          display: true,
          text: spec.title,
          font: { size: 16, weight: 'bold' },
          color: '#1A1A1A',
          padding: { bottom: spec.subtitle ? 2 : 16 },
        },
        subtitle: spec.subtitle ? {
          display: true,
          text: spec.subtitle,
          font: { size: 12 },
          color: '#6B7280',
          padding: { bottom: 16 },
        } : undefined,
        legend: {
          display: spec.series.length > 1 || spec.chartType === 'pie',
          position: 'bottom',
          labels: {
            font: { size: 11 },
            color: '#6B7280',
            usePointStyle: true,
            padding: 16,
          },
        },
      },
      scales: spec.chartType === 'pie' ? {} : {
        x: {
          display: true,
          title: spec.xAxis.label ? {
            display: true,
            text: spec.xAxis.label,
            font: { size: 11 },
            color: '#6B7280',
          } : undefined,
          ticks: {
            font: { size: 10 },
            color: '#9CA3AF',
            maxRotation: 45,
          },
          grid: { display: false },
          stacked: spec.stacked || false,
        },
        y: {
          display: true,
          title: spec.yAxis?.label ? {
            display: true,
            text: spec.yAxis.label,
            font: { size: 11 },
            color: '#6B7280',
          } : undefined,
          ticks: {
            font: { size: 10 },
            color: '#9CA3AF',
            callback: (v) => formatValue(v, yFormat),
          },
          grid: {
            color: '#F0F0F0',
          },
          stacked: spec.stacked || false,
        },
      },
    },
  };

  // Render chart
  const chart = new Chart(ctx, config);
  chart.draw();

  // Export to base64 PNG
  const base64 = canvas.toBuffer('image/png').toString('base64');

  // Cleanup
  chart.destroy();

  return base64;
}

module.exports = { renderChart };
