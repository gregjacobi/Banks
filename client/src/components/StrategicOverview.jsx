import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  Divider,
  Link,
  Tooltip,
  IconButton,
  Collapse,
  Button
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TimelineIcon from '@mui/icons-material/Timeline';
import HandshakeIcon from '@mui/icons-material/Handshake';
import InfoIcon from '@mui/icons-material/Info';
import LinkIcon from '@mui/icons-material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import OrganizationalChart from './OrganizationalChart';

/**
 * Citation Component
 * Displays a citation with clickable link and quoted text
 */
const Citation = ({ citation, index }) => {
  const [expanded, setExpanded] = useState(false);

  const citationLabel = `[${index + 1}]`;
  const pageInfo = citation.pageNumber ? `, p.${citation.pageNumber}` : '';
  const citationText = `${citation.documentTitle}${pageInfo}`;

  return (
    <Box sx={{ mt: 1, mb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: '#d97757',
            minWidth: '30px'
          }}
        >
          {citationLabel}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {citation.documentUrl ? (
              <Link
                href={citation.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: '#d97757',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  },
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {citationText}
                </Typography>
                <LinkIcon sx={{ fontSize: 14 }} />
              </Link>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                {citationText}
              </Typography>
            )}
            {citation.citedText && (
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
                sx={{ padding: 0.5 }}
              >
                {expanded ? <ExpandLessIcon fontSize="small" /> : <FormatQuoteIcon fontSize="small" />}
              </IconButton>
            )}
          </Box>
          <Collapse in={expanded}>
            <Box
              sx={{
                mt: 0.5,
                p: 1,
                bgcolor: '#f5f5f5',
                borderLeft: '3px solid #d97757',
                borderRadius: 1
              }}
            >
              <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                "{citation.citedText}"
              </Typography>
            </Box>
          </Collapse>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Citations List Component
 * Displays all citations for an insight
 */
const CitationsList = ({ citations }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1, display: 'block' }}>
        Sources:
      </Typography>
      {citations.map((citation, index) => (
        <Citation key={index} citation={citation} index={index} />
      ))}
    </Box>
  );
};

/**
 * Methodology Component
 * Shows how an insight was determined
 */
const Methodology = ({ text }) => {
  if (!text) return null;

  return (
    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
      <InfoIcon sx={{ fontSize: 16, color: '#d97757', mt: 0.2 }} />
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        <strong>Methodology:</strong> {text}
      </Typography>
    </Box>
  );
};

/**
 * StrategicOverview Component
 * Displays bank's strategic insights extracted from RAG pipeline and organizational structure
 */
function StrategicOverview({ metadata }) {
  if (!metadata) {
    return (
      <Box>
        <Alert severity="info">
          No strategic information available. Use the AI Research tab to gather metadata and extract insights.
        </Alert>
      </Box>
    );
  }

  const { strategicInsights, orgChart } = metadata;
  const hasInsights = strategicInsights?.status === 'completed';
  const hasOrgChart = orgChart && (orgChart.boardMembers?.length > 0 || orgChart.executives?.length > 0);

  // If we have neither insights nor org chart
  if (!hasInsights && !hasOrgChart) {
    return (
      <Box>
        <Alert severity="info">
          No strategic information available yet. Use the AI Research tab to:
          <ul>
            <li>Gather organizational structure data</li>
            <li>Upload documents to RAG pipeline</li>
            <li>Extract strategic insights</li>
          </ul>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Strategic Insights Section */}
      {hasInsights && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Strategic Insights
          </Typography>

          {/* Strategic Priorities */}
          {strategicInsights.priorities?.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <TrendingUpIcon sx={{ color: '#d97757', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Top Strategic Priorities
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {strategicInsights.priorities.map((priority, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        '&:hover': {
                          boxShadow: 2,
                          transition: 'box-shadow 0.3s'
                        }
                      }}
                    >
                      <CardContent>
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600, mb: 1, color: '#d97757' }}
                        >
                          {priority.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                          {priority.description}
                        </Typography>
                        <Methodology text={priority.methodology} />
                        <CitationsList citations={priority.citations} />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Focus Metrics */}
          {strategicInsights.focusMetrics?.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <TimelineIcon sx={{ color: '#d97757', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Key Performance Metrics
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Metrics that management and investors are focused on:
              </Typography>
              <Grid container spacing={2}>
                {strategicInsights.focusMetrics.map((metricData, index) => (
                  <Grid item xs={12} key={index}>
                    <Card
                      variant="outlined"
                      sx={{
                        '&:hover': {
                          boxShadow: 2,
                          transition: 'box-shadow 0.3s'
                        }
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Chip
                            label={metricData.metric}
                            size="small"
                            sx={{
                              bgcolor: '#d97757',
                              color: 'white',
                              fontWeight: 600
                            }}
                          />
                        </Box>
                        {metricData.commentary && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                            {metricData.commentary}
                          </Typography>
                        )}
                        <Methodology text={metricData.methodology} />
                        <CitationsList citations={metricData.citations} />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Technology Partnerships */}
          {strategicInsights.techPartnerships?.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <HandshakeIcon sx={{ color: '#d97757', fontSize: 28 }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Technology Partnerships & Initiatives
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {strategicInsights.techPartnerships.map((partnership, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        '&:hover': {
                          boxShadow: 2,
                          transition: 'box-shadow 0.3s'
                        }
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: 600, color: '#d97757' }}
                          >
                            {partnership.partner}
                          </Typography>
                          {partnership.announcedDate && (
                            <Chip
                              label={partnership.announcedDate}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                        {partnership.description && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                            {partnership.description}
                          </Typography>
                        )}
                        <Methodology text={partnership.methodology} />
                        <CitationsList citations={partnership.citations} />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Overall Extraction Methodology */}
          {strategicInsights.extractionMethodology && (
            <Paper elevation={1} sx={{ p: 3, mb: 3, bgcolor: '#fafafa' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
                <InfoIcon sx={{ color: '#d97757', fontSize: 24, mt: 0.5 }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    Research Methodology
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {strategicInsights.extractionMethodology}
                  </Typography>
                </Box>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  <strong>Source Type:</strong> {strategicInsights.source || 'RAG analysis'}
                </Typography>
                {strategicInsights.lastExtracted && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                    <strong>Last Extracted:</strong>{' '}
                    {new Date(strategicInsights.lastExtracted).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Typography>
                )}
              </Box>
            </Paper>
          )}

          {/* Legacy Insights Metadata (for backward compatibility) */}
          {strategicInsights.source && !strategicInsights.extractionMethodology && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <strong>Source:</strong> {strategicInsights.source}
              </Typography>
              {strategicInsights.lastExtracted && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
                  <strong>Last Extracted:</strong>{' '}
                  {new Date(strategicInsights.lastExtracted).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Insights extraction in progress */}
      {strategicInsights?.status === 'extracting' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Strategic insights are currently being extracted from your RAG pipeline...
        </Alert>
      )}

      {/* Insights extraction failed */}
      {strategicInsights?.status === 'failed' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to extract strategic insights: {strategicInsights.extractionError || 'Unknown error'}
        </Alert>
      )}

      {/* Divider between insights and org chart */}
      {hasInsights && hasOrgChart && (
        <Divider sx={{ my: 4 }} />
      )}

      {/* Organizational Chart Section */}
      {hasOrgChart && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
            Leadership & Governance
          </Typography>
          <OrganizationalChart metadata={metadata} />
        </Box>
      )}
    </Box>
  );
}

export default StrategicOverview;
