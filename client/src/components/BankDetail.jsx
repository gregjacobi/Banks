import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Card,
  CardContent,
  Tabs,
  Tab,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CalculateIcon from '@mui/icons-material/Calculate';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PeopleIcon from '@mui/icons-material/People';
import BalanceSheet from './BalanceSheet';
import IncomeStatement from './IncomeStatement';
import TrendsTab from './TrendsTabCompact';
import RatiosTab from './RatiosTab';
import PeerComparisonTab from './PeerComparisonTab';
import AIContentTab from './AIContentTab';
import CreditQualityTab from './CreditQualityTab';
import StrategicOverview from './StrategicOverview';
import CompactPodcastPlayer from './CompactPodcastPlayer';
import TAMDetailTab from './TAMDetailTab';
import { AIProvider } from '../contexts/AIContext';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

/**
 * Bank Detail View
 * Displays bank information with tabs for Balance Sheet and Income Statement
 */
// Tab name to index mapping for URL-based navigation
const TAB_MAP = {
  'glance': 0,
  'strategic': 1,
  'balance': 2,
  'income': 3,
  'ratios': 4,
  'credit': 5,
  'peer': 6,
  'tam': 7,
  'research': 8
};

function BankDetail() {
  const { idrssd } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankData, setBankData] = useState(null);

  // Initialize activeTab from URL param or default to 0
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam && TAB_MAP[tabParam] !== undefined ? TAB_MAP[tabParam] : 0;
  const [activeTab, setActiveTab] = useState(initialTab);

  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [previousPeriodData, setPreviousPeriodData] = useState(null);
  const [podcastUrl, setPodcastUrl] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);

  // Update URL when tab changes
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Find tab name from index
    const tabName = Object.entries(TAB_MAP).find(([, idx]) => idx === newValue)?.[0];
    if (tabName) {
      setSearchParams({ tab: tabName });
    }
  };
  const [metadata, setMetadata] = useState(null);
  const [hasReport, setHasReport] = useState(false);
  const [hasPodcast, setHasPodcast] = useState(false);
  const [hasPresentation, setHasPresentation] = useState(false);

  useEffect(() => {
    const fetchBankData = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = selectedPeriod
          ? `/api/banks/${idrssd}?period=${selectedPeriod}`
          : `/api/banks/${idrssd}`;
        const response = await axios.get(url);
        setBankData(response.data);
        setAvailablePeriods(response.data.availablePeriods || []);

        // Set selected period to latest if not set
        if (!selectedPeriod && response.data.availablePeriods?.length > 0) {
          setSelectedPeriod(response.data.availablePeriods[0]);
        }

        // Fetch previous period for trend comparison
        if (response.data.availablePeriods?.length > 1) {
          const currentIndex = response.data.availablePeriods.findIndex(p => p === (selectedPeriod || response.data.availablePeriods[0]));
          if (currentIndex < response.data.availablePeriods.length - 1) {
            const prevPeriod = response.data.availablePeriods[currentIndex + 1];
            const prevResponse = await axios.get(`/api/banks/${idrssd}?period=${prevPeriod}`);
            setPreviousPeriodData(prevResponse.data.financialStatement);
          }
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load bank data');
        console.error('Error fetching bank data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBankData();
  }, [idrssd, selectedPeriod]);

  // Fetch historical data for sparklines (similar to TrendsTab)
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!availablePeriods || availablePeriods.length === 0) {
        return;
      }

      try {
        // Fetch financial statements for all periods
        const requests = availablePeriods.map(period =>
          axios.get(`/api/banks/${idrssd}?period=${period}`)
        );
        const responses = await Promise.all(requests);
        const statements = responses.map(r => r.data.financialStatement);

        // Sort by period (oldest first for trends)
        statements.sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod));

        setHistoricalData(statements);
      } catch (error) {
        console.error('Error fetching historical data:', error);
      }
    };

    fetchHistoricalData();
  }, [idrssd, availablePeriods]);

  // Fetch bank metadata (logo, ticker, org chart)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await axios.get(`/api/research/${idrssd}/metadata`);
        if (response.data.metadata) {
          setMetadata(response.data.metadata);
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };

    if (idrssd) {
      fetchMetadata();
    }
  }, [idrssd]);

  // Check if AI research report exists
  useEffect(() => {
    const checkReport = async () => {
      try {
        const response = await axios.get(`/api/research/${idrssd}/history`);
        setHasReport(response.data.reports?.length > 0);
      } catch (error) {
        setHasReport(false);
      }
    };

    if (idrssd) {
      checkReport();
    }
  }, [idrssd]);

  // Check if podcast exists
  useEffect(() => {
    const checkPodcast = async () => {
      try {
        const response = await axios.get(`/api/research/${idrssd}/podcast/latest`);
        setHasPodcast(!!response.data.podcast);
      } catch (error) {
        setHasPodcast(false);
      }
    };

    if (idrssd) {
      checkPodcast();
    }
  }, [idrssd]);

  // Check if presentation exists
  useEffect(() => {
    const checkPresentation = async () => {
      try {
        const response = await axios.get(`/api/research/${idrssd}/presentations`);
        setHasPresentation(response.data.presentations?.length > 0);
      } catch (error) {
        setHasPresentation(false);
      }
    };

    if (idrssd) {
      checkPresentation();
    }
  }, [idrssd]);

  const formatAssets = (assets) => {
    if (!assets) return 'N/A';
    // Assets are in thousands
    const millions = assets / 1000;
    if (millions >= 1000) {
      return `$${(millions / 1000).toFixed(2)}B`;
    }
    return `$${millions.toFixed(2)}M`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ mb: 2 }}
        >
          Back to Search
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!bankData) {
    return <Typography>No data available</Typography>;
  }

  const { institution, financialStatement } = bankData;
  const totalAssets = financialStatement?.balanceSheet?.assets?.totalAssets;
  const reportingPeriod = financialStatement?.reportingPeriod
    ? new Date(financialStatement.reportingPeriod).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'N/A';

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ mb: 2 }}
      >
        Back to Search
      </Button>

      {/* Bank Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {institution.website ? (
                <a
                  href={institution.website.startsWith('http') ? institution.website : `https://${institution.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center' }}
                >
                  <img
                    src={`/api/research/${idrssd}/logo`}
                    alt={`${institution.name} logo`}
                    style={{
                      height: '48px',
                      maxWidth: '200px',
                      objectFit: 'contain',
                      cursor: 'pointer'
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </a>
              ) : (
                <img
                  src={`/api/research/${idrssd}/logo`}
                  alt={`${institution.name} logo`}
                  style={{
                    height: '48px',
                    maxWidth: '200px',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {institution.website ? (
                  <a
                    href={institution.website.startsWith('http') ? institution.website : `https://${institution.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 700, cursor: 'pointer', '&:hover': { color: '#D97757' } }}>
                      {institution.name}
                    </Typography>
                  </a>
                ) : (
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {institution.name}
                  </Typography>
                )}
                {/* Status Badge Icons */}
                <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                  {/* Mini Logo Badge - removed, logo already displayed above */}
                  {false && metadata?.logo?.localPath && (
                    <img
                      src={`/api/research/${idrssd}/logo`}
                      alt="Logo"
                      title="Bank logo available"
                      style={{
                        height: '20px',
                        width: '20px',
                        objectFit: 'contain',
                        opacity: 0.8,
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        padding: '2px',
                        backgroundColor: 'white'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  {/* Research Workflow Phase & Output Indicators */}
                  {metadata?.researchPhases && (
                    <Box sx={{ display: 'flex', gap: 1.5, ml: 0.5, alignItems: 'center' }}>
                      {/* Phase indicators */}
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <span title="Phase 1: Gather Sources">
                          {(() => {
                            const status = metadata.researchPhases.phase1?.status || 'not_started';
                            const icons = { 'not_started': '⏳', 'in_progress': '🔄', 'completed': '✅', 'failed': '❌' };
                            return icons[status] || '⏳';
                          })()}
                        </span>
                        <span title="Phase 2: Generate Report">
                          {(() => {
                            const status = metadata.researchPhases.phase2?.status || 'not_started';
                            const icons = { 'not_started': '⏳', 'in_progress': '🔄', 'completed': '✅', 'failed': '❌' };
                            return icons[status] || '⏳';
                          })()}
                        </span>
                        <span title="Phase 3: Generate Outputs">
                          {(() => {
                            const phase3Status = metadata.researchPhases.phase3?.status || 'not_started';
                            const phase4Status = metadata.researchPhases.phase4?.status || 'not_started';
                            let consolidatedStatus = 'not_started';
                            if (phase3Status === 'failed' || phase4Status === 'failed') consolidatedStatus = 'failed';
                            else if (phase3Status === 'in_progress' || phase4Status === 'in_progress') consolidatedStatus = 'in_progress';
                            else if (phase3Status === 'completed' && phase4Status === 'completed') consolidatedStatus = 'completed';
                            const icons = { 'not_started': '⏳', 'in_progress': '🔄', 'completed': '✅', 'failed': '❌' };
                            return icons[consolidatedStatus] || '⏳';
                          })()}
                        </span>
                      </Box>
                      {/* Output indicators */}
                      <Box sx={{ display: 'flex', gap: 0.5, borderLeft: '1px solid #e0e0e0', pl: 1.5 }}>
                        <span title={hasReport ? "Research Report Available" : "Research Report Not Available"} style={{opacity: hasReport ? 1 : 0.3}}>📄</span>
                        <span title={hasPodcast ? "Podcast Available" : "Podcast Not Available"} style={{opacity: hasPodcast ? 1 : 0.3}}>🎙️</span>
                        <span title={hasPresentation ? "Presentation Available" : "Presentation Not Available"} style={{opacity: hasPresentation ? 1 : 0.3}}>📊</span>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
            {availablePeriods.length > 1 && (
              <FormControl sx={{ minWidth: 200 }} size="small">
                <InputLabel>Reporting Period</InputLabel>
                <Select
                  value={selectedPeriod}
                  label="Reporting Period"
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  {availablePeriods.map((period) => {
                    const date = new Date(period);
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;
                    const quarter = Math.ceil(month / 3);
                    const label = `${year} Q${quarter}`;
                    return (
                      <MenuItem key={period} value={period}>
                        {label} ({date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })})
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Location
              </Typography>
              <Typography variant="body1">
                {institution.city}, {institution.state}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                FDIC Cert #
              </Typography>
              <Typography variant="body1">{institution.fdicCert}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                ID RSSD
              </Typography>
              <Typography variant="body1">{institution.idrssd}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Total Assets
              </Typography>
              <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
                {formatAssets(totalAssets)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Reporting Period
              </Typography>
              <Typography variant="body1">{reportingPeriod}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Financial Statements Tabs */}
      <AIProvider idrssd={idrssd} bankName={institution?.name}>
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              sx={{
                minHeight: 48,
                '& .MuiTab-root': {
                  minWidth: 'auto',
                  minHeight: 48,
                  px: 2,
                  py: 1
                }
              }}
            >
              {/* Overview Section */}
              <Tab
                icon={<DashboardIcon sx={{ fontSize: 22 }} />}
                aria-label="At a Glance"
                title="At a Glance"
              />
              <Tab
                icon={<LightbulbIcon sx={{ fontSize: 22 }} />}
                aria-label="Strategic Overview"
                title="Strategic Overview"
              />

              {/* Financials Section */}
              <Tab
                icon={<AccountBalanceIcon sx={{ fontSize: 22 }} />}
                aria-label="Balance Sheet"
                title="Balance Sheet"
              />
              <Tab
                icon={<ReceiptLongIcon sx={{ fontSize: 22 }} />}
                aria-label="Income Statement"
                title="Income Statement"
              />
              <Tab
                icon={<CalculateIcon sx={{ fontSize: 22 }} />}
                aria-label="Ratios"
                title="Ratios"
              />
              <Tab
                icon={<WarningAmberIcon sx={{ fontSize: 22 }} />}
                aria-label="Credit Quality"
                title="Credit Quality"
              />

              {/* Analysis Section */}
              <Tab
                icon={<CompareArrowsIcon sx={{ fontSize: 22 }} />}
                aria-label="Peer Comparison"
                title="Peer Comparison"
              />
              <Tab
                icon={<PeopleIcon sx={{ fontSize: 22 }} />}
                aria-label="TAM"
                title="TAM (Total Addressable Market)"
              />

              {/* AI Section */}
              <Tab
                icon={<img src="/claude-icon.svg" alt="AI Research" style={{ width: 22, height: 22 }} />}
                aria-label="AI Research Report"
                title="AI Research Report"
              />
            </Tabs>

            {/* Research Builder - separate button that opens in new tab */}
            <Tooltip title="Open Research Builder in new window" arrow>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/research/${idrssd}`, '_blank', 'width=1400,height=900');
                }}
                sx={{
                  minWidth: 'auto',
                  px: 2,
                  py: 1,
                  color: 'text.secondary',
                  '&:hover': { color: '#d97757', bgcolor: 'rgba(217, 119, 87, 0.08)' }
                }}
              >
                <OpenInNewIcon sx={{ fontSize: 22 }} />
              </Button>
            </Tooltip>

            {/* Tab Legend - shows current tab name */}
            <Box sx={{ ml: 'auto', mr: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                {['At a Glance', 'Strategic Overview', 'Balance Sheet', 'Income Statement', 'Ratios', 'Credit Quality', 'Peer Comparison', 'TAM', 'AI Research'][activeTab]}
              </Typography>
            </Box>
          </Box>

          <CardContent sx={{ p: 3 }}>
            {activeTab === 0 && (
              <TrendsTab idrssd={idrssd} availablePeriods={availablePeriods} metadata={metadata} />
            )}
            {activeTab === 1 && (
              <StrategicOverview metadata={metadata} />
            )}
            {activeTab === 2 && (
              <BalanceSheet
                balanceSheet={financialStatement?.balanceSheet}
                historicalData={historicalData}
              />
            )}
            {activeTab === 3 && (
              <IncomeStatement incomeStatement={financialStatement?.incomeStatement} />
            )}
            {activeTab === 4 && (
              <RatiosTab
                financialStatement={financialStatement}
                previousPeriodStatement={previousPeriodData}
                historicalData={historicalData}
                metadata={metadata}
              />
            )}
            {activeTab === 5 && (
              <CreditQualityTab
                financialStatement={financialStatement}
                previousStatement={previousPeriodData}
              />
            )}
            {activeTab === 6 && (
              <PeerComparisonTab idrssd={idrssd} availablePeriods={availablePeriods} />
            )}
            {activeTab === 7 && (
              <TAMDetailTab idrssd={idrssd} bankName={institution?.name} />
            )}
            {activeTab === 8 && (
              <AIContentTab idrssd={idrssd} bankName={institution?.name} />
            )}
          </CardContent>
        </Card>
      </AIProvider>

      {/* Validation Warnings */}
      {financialStatement?.validation && !financialStatement.validation.balanceSheetValid && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Balance sheet validation warning: Assets may not equal Liabilities + Equity
        </Alert>
      )}

      {/* Compact Podcast Player */}
      {podcastUrl && (
        <CompactPodcastPlayer
          podcastUrl={podcastUrl}
          bankName={institution?.name}
          onClose={() => setPodcastUrl(null)}
        />
      )}
    </Box>
  );
}

export default BankDetail;
