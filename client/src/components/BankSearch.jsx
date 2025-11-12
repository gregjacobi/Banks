import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Card,
  CardContent,
  Autocomplete,
  TextField,
  Typography,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import MultiBankUBPRValidation from './MultiBankUBPRValidation';
import FFIECUploadTab from './FFIECUploadTab';

/**
 * Bank Search Component
 * Allows users to search for banks by name with autocomplete
 * Results sorted by total assets
 */
function BankSearch() {
  const navigate = useNavigate();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [topBanks, setTopBanks] = useState([]);
  const [topBanksLoading, setTopBanksLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Fetch top 50 banks on component mount
  useEffect(() => {
    const fetchTopBanks = async () => {
      setTopBanksLoading(true);
      try {
        const response = await axios.get('/api/banks', {
          params: {
            sortBy: 'totalAssets',
            limit: 50
          }
        });
        setTopBanks(response.data.banks);
      } catch (error) {
        console.error('Error fetching top banks:', error);
      } finally {
        setTopBanksLoading(false);
      }
    };

    fetchTopBanks();
  }, []);

  // Fetch banks for autocomplete search
  useEffect(() => {
    if (inputValue.length < 2) {
      setOptions([]);
      return;
    }

    const fetchBanks = async () => {
      setLoading(true);
      try {
        const response = await axios.get('/api/banks', {
          params: {
            search: inputValue,
            sortBy: 'totalAssets',
            limit: 20
          }
        });
        setOptions(response.data.banks);
      } catch (error) {
        console.error('Error fetching banks:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchBanks, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  const formatAssets = (assets) => {
    if (!assets) return 'N/A';
    // Assets are in thousands
    const millions = assets / 1000;
    if (millions >= 1000) {
      return `$${(millions / 1000).toFixed(2)}B`;
    }
    return `$${millions.toFixed(2)}M`;
  };

  const handleBankSelect = (event, bank) => {
    if (bank) {
      navigate(`/bank/${bank.idrssd}`);
    }
  };

  return (
    <Box>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Bank List" />
          <Tab label="UBPR Validation" />
          <Tab label="FFIEC Upload" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* Search Card */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
                Bank Explorer
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Search by name or browse the top 50 banks by total assets
              </Typography>

          <Autocomplete
            options={options}
            getOptionLabel={(option) => option.name}
            loading={loading}
            onInputChange={(event, newInputValue) => {
              setInputValue(newInputValue);
            }}
            onChange={handleBankSelect}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Bank Name"
                placeholder="e.g., JPMorgan, Wells Fargo"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box
                component="li"
                {...props}
                sx={{
                  display: 'flex !important',
                  justifyContent: 'space-between !important',
                  alignItems: 'center !important',
                  py: 1.5,
                }}
              >
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {option.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.city}, {option.state}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: 'primary.main',
                    ml: 2,
                  }}
                >
                  {formatAssets(option.totalAssets)}
                </Typography>
              </Box>
            )}
            noOptionsText={
              inputValue.length < 2
                ? 'Type at least 2 characters to search'
                : 'No banks found'
            }
          />
        </CardContent>
      </Card>

      {/* Top 50 Banks Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Top 50 Banks by Total Assets
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Click any row to view detailed financial statements
          </Typography>

          {topBanksLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ bgcolor: '#fafafa' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Rank</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Institution Name</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Location</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total Assets</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Net Income</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ROE %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Eff. Ratio %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Employees</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {topBanks.map((bank, index) => (
                    <TableRow
                      key={bank.idrssd}
                      onClick={() => navigate(`/bank/${bank.idrssd}`)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { bgcolor: '#e3f2fd' },
                        bgcolor: index % 2 === 0 ? 'white' : '#fafafa'
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.75rem' }}>{index + 1}</TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        {bank.name}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {bank.city}, {bank.state}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        {formatAssets(bank.totalAssets)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                        {bank.netIncome ? `$${(bank.netIncome / 1000).toFixed(1)}M` : 'N/A'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                        {bank.roe ? bank.roe.toFixed(2) : 'N/A'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                        {bank.efficiencyRatio ? bank.efficiencyRatio.toFixed(1) : 'N/A'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem' }}>
                        {bank.fullTimeEquivalentEmployees || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
        </Box>
      )}

      {/* UBPR Validation Tab */}
      {activeTab === 1 && (
        <MultiBankUBPRValidation banks={topBanks} />
      )}

      {/* FFIEC Upload Tab */}
      {activeTab === 2 && (
        <FFIECUploadTab />
      )}
    </Box>
  );
}

export default BankSearch;
