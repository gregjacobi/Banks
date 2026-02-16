import { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { COLORS, FONTS, BASE_STYLES } from './shared/theme';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Insight {
  type?: string;
  title?: string;
  content?: string;
  summary?: string;
  significance?: string;
  source?: string;
}

interface ReportMeta {
  idrssd: string;
  bankName: string;
  generatedAt: string;
  apiBaseUrl: string;
  insightCount?: number;
  preview?: string;
}

interface FullReport {
  idrssd: string;
  bankName: string;
  generatedAt: string;
  analysis: string;
  agentInsights?: Insight[];
  agentStats?: Record<string, unknown>;
  method?: string;
  model?: string;
}

/* ------------------------------------------------------------------ */
/*  Minimal Markdown → HTML (no external dep)                          */
/* ------------------------------------------------------------------ */

function markdownToHtml(md: string): string {
  let html = md
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre style="background:#F3F4F6;padding:12px;border-radius:6px;overflow-x:auto;font-size:13px;line-height:1.5;font-family:${FONTS.mono}"><code>${escapeHtml(code.trim())}</code></pre>`)
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, `<code style="background:#F3F4F6;padding:2px 5px;border-radius:3px;font-size:0.9em;font-family:${FONTS.mono}">$1</code>`)
    // Horizontal rules
    .replace(/^---+$/gm, `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0" />`)
    // Unordered lists
    .replace(/^(\s*)[-*] (.+)$/gm, '$1<li>$2</li>')
    // Ordered lists
    .replace(/^(\s*)\d+\. (.+)$/gm, '$1<li>$2</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener" style="color:${COLORS.primary}">$1</a>`)
    // Line breaks → paragraphs (double newline)
    .replace(/\n\n+/g, '</p><p>')
    // Single newlines inside paragraphs
    .replace(/\n/g, '<br/>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '$1</ul>');
  html = html.replace(/(?<!<\/ul>)(<li>)/g, '<ul style="margin:8px 0;padding-left:24px">$1');

  return `<p>${html}</p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = {
  prose: {
    fontSize: 14,
    lineHeight: 1.7,
    color: COLORS.text,
    maxWidth: 800,
  } as React.CSSProperties,
  insightCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  } as React.CSSProperties,
  insightType: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: COLORS.primary,
    backgroundColor: `${COLORS.primary}15`,
    padding: '2px 8px',
    borderRadius: 4,
    marginBottom: 8,
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? COLORS.primary : COLORS.textSecondary,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: active ? `2px solid ${COLORS.primary}` : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: FONTS.primary,
  }) as React.CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
    marginBottom: 16,
  } as React.CSSProperties,
  statCard: {
    backgroundColor: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 12,
    textAlign: 'center' as const,
  } as React.CSSProperties,
};

/* ------------------------------------------------------------------ */
/*  Components                                                         */
/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{value}</div>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: Insight[] }) {
  const grouped = useMemo(() => {
    const groups: Record<string, Insight[]> = {};
    for (const ins of insights) {
      const type = ins.type || 'general';
      if (!groups[type]) groups[type] = [];
      groups[type].push(ins);
    }
    return groups;
  }, [insights]);

  return (
    <div>
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} style={{ marginBottom: 20 }}>
          <h3 style={{ ...BASE_STYLES.sectionTitle, fontSize: 14, textTransform: 'capitalize' }}>
            {type.replace(/_/g, ' ')} ({items.length})
          </h3>
          {items.map((ins, i) => (
            <div key={i} style={styles.insightCard}>
              {ins.type && <div style={styles.insightType}>{ins.type.replace(/_/g, ' ')}</div>}
              {ins.title && <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600 }}>{ins.title}</h4>}
              <p style={{ margin: 0, fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                {ins.content || ins.summary || ''}
              </p>
              {ins.significance && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' }}>
                  Significance: {ins.significance}
                </p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReportView({ report }: { report: FullReport }) {
  const [activeTab, setActiveTab] = useState<'report' | 'insights' | 'stats'>('report');

  const hasInsights = report.agentInsights && report.agentInsights.length > 0;
  const hasStats = report.agentStats && Object.keys(report.agentStats).length > 0;

  const generatedDate = new Date(report.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div style={BASE_STYLES.container}>
      <h1 style={{ ...BASE_STYLES.title, fontSize: 22 }}>{report.bankName}</h1>
      <p style={BASE_STYLES.subtitle}>
        Research Report | Generated {generatedDate}
        {report.method && ` | ${report.method}`}
      </p>

      {/* Quick stats bar */}
      <div style={styles.statsGrid}>
        <StatCard label="Bank ID" value={report.idrssd} />
        <StatCard label="Insights" value={report.agentInsights?.length ?? 0} />
        <StatCard label="Method" value={report.method || 'agent-based'} />
        <StatCard label="Generated" value={new Date(report.generatedAt).toLocaleDateString()} />
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16, display: 'flex', gap: 0 }}>
        <button style={styles.tab(activeTab === 'report')} onClick={() => setActiveTab('report')}>
          Full Report
        </button>
        {hasInsights && (
          <button style={styles.tab(activeTab === 'insights')} onClick={() => setActiveTab('insights')}>
            Insights ({report.agentInsights!.length})
          </button>
        )}
        {hasStats && (
          <button style={styles.tab(activeTab === 'stats')} onClick={() => setActiveTab('stats')}>
            Agent Stats
          </button>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'report' && report.analysis && (
        <div style={styles.prose} dangerouslySetInnerHTML={{ __html: markdownToHtml(report.analysis) }} />
      )}

      {activeTab === 'insights' && hasInsights && (
        <InsightsPanel insights={report.agentInsights!} />
      )}

      {activeTab === 'stats' && hasStats && (
        <div style={BASE_STYLES.card}>
          <pre style={{ fontSize: 12, lineHeight: 1.5, fontFamily: FONTS.mono, whiteSpace: 'pre-wrap', margin: 0 }}>
            {JSON.stringify(report.agentStats, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  App Root                                                           */
/* ------------------------------------------------------------------ */

function AppRoot() {
  const [report, setReport] = useState<FullReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const app = new App({ name: 'Research Report', version: '1.0.0' });

    app.ontoolresult = async (result) => {
      try {
        const text = result.content?.find((c: { type: string }) => c.type === 'text')?.text;
        if (!text) { setError('No data received'); setLoading(false); return; }

        const meta = JSON.parse(text) as ReportMeta;
        if (!meta.idrssd || !meta.apiBaseUrl) {
          setError('Invalid report metadata: missing idrssd or apiBaseUrl');
          setLoading(false);
          return;
        }

        // Fetch the full report directly from the Bank Explorer API
        const url = `${meta.apiBaseUrl}/api/research/${meta.idrssd}/latest`;
        const resp = await fetch(url);
        if (!resp.ok) {
          setError(`Failed to load report: ${resp.status} ${resp.statusText}`);
          setLoading(false);
          return;
        }

        const data = await resp.json();
        if (!data.hasReport || !data.report) {
          setError('No report available for this bank.');
          setLoading(false);
          return;
        }

        setReport(data.report as FullReport);
        setError(null);
      } catch (e) {
        setError(`Failed to load report: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    };

    app.connect();
  }, []);

  if (error) {
    return (
      <div style={{ ...BASE_STYLES.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...BASE_STYLES.card, textAlign: 'center', color: COLORS.danger, maxWidth: 400 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Error Loading Report</p>
          <p style={{ fontSize: 13 }}>{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !report) {
    return (
      <div style={{ ...BASE_STYLES.container, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: COLORS.textSecondary }}>
          <div style={{
            width: 32, height: 32, border: `3px solid ${COLORS.border}`,
            borderTopColor: COLORS.primary, borderRadius: '50%',
            animation: 'spin 1s linear infinite', margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: 13 }}>Loading research report...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return <ReportView report={report} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<AppRoot />);
