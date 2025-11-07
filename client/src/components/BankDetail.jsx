import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  InputLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BalanceSheet from './BalanceSheet';
import IncomeStatement from './IncomeStatement';
import TrendsTab from './TrendsTabCompact';
import RatiosTab from './RatiosTab';
import PeerComparisonTab from './PeerComparisonTab';
import AIBuilderTab from './AIBuilderTab';
import AIContentTab from './AIContentTab';
import CompactPodcastPlayer from './CompactPodcastPlayer';
import { AIProvider } from '../contexts/AIContext';

/**
 * Bank Detail View
 * Displays bank information with tabs for Balance Sheet and Income Statement
 */
function BankDetail() {
  const { idrssd } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankData, setBankData] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [previousPeriodData, setPreviousPeriodData] = useState(null);
  const [podcastUrl, setPodcastUrl] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);

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

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

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
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {institution.name}
            </Typography>
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
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="At a Glance" />
              <Tab label="Balance Sheet" />
              <Tab label="Income Statement" />
              <Tab label="Ratios" />
              <Tab label="Peer Comparison" />
              <Tab label="AI Builder" />
              <Tab label="AI Content" />
            </Tabs>
          </Box>

          <CardContent sx={{ p: 3 }}>
            {activeTab === 0 && (
              <TrendsTab idrssd={idrssd} availablePeriods={availablePeriods} />
            )}
            {activeTab === 1 && (
              <BalanceSheet
                balanceSheet={financialStatement?.balanceSheet}
                historicalData={historicalData}
              />
            )}
            {activeTab === 2 && (
              <IncomeStatement incomeStatement={financialStatement?.incomeStatement} />
            )}
            {activeTab === 3 && (
              <RatiosTab
                financialStatement={financialStatement}
                previousPeriodStatement={previousPeriodData}
                historicalData={historicalData}
              />
            )}
            {activeTab === 4 && (
              <PeerComparisonTab idrssd={idrssd} availablePeriods={availablePeriods} />
            )}
            {activeTab === 5 && (
              <AIBuilderTab
                idrssd={idrssd}
                bankName={institution.name}
              />
            )}
            {activeTab === 6 && (
              <AIContentTab
                idrssd={idrssd}
                bankName={institution.name}
                onNavigateToBuilder={() => setActiveTab(5)}
              />
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
