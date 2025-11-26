import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
// Tabs removed - navigation now handled by top navbar
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import BankLogo from './BankLogo';

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
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [researchStatuses, setResearchStatuses] = useState({});

  // Fetch top 100 banks on component mount
  useEffect(() => {
    const fetchTopBanks = async () => {
      setTopBanksLoading(true);
      try {
        const response = await axios.get('/api/banks', {
          params: {
            sortBy: 'totalAssets',
            limit: 100
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

  // Fetch research statuses for all top banks
  useEffect(() => {
    const fetchResearchStatuses = async () => {
      if (topBanks.length === 0) return;

      const statuses = {};
      // Fetch in batches to avoid overwhelming the server
      for (const bank of topBanks) {
        try {
          const response = await axios.get(`/api/research/${bank.idrssd}/status`);
          statuses[bank.idrssd] = response.data.status;
        } catch (error) {
          // If status endpoint fails, assume not started
          statuses[bank.idrssd] = {
            phase1: 'not_started',
            phase2: 'not_started',
            phase3: 'not_started',
            phase4: 'not_started'
          };
        }
      }
      setResearchStatuses(statuses);
    };

    fetchResearchStatuses();
  }, [topBanks]);

  // Fetch banks for autocomplete search
  useEffect(() => {
    if (inputValue.length < 2) {
      setOptions([]);
      setShowDropdown(false);
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
        setShowDropdown(true);
      } catch (error) {
        console.error('Error fetching banks:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchBanks, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatAssets = (assets) => {
    if (!assets) return 'N/A';
    // Assets are in thousands
    const millions = assets / 1000;
    if (millions >= 1000) {
      return `$${(millions / 1000).toFixed(2)}B`;
    }
    return `$${millions.toFixed(2)}M`;
  };

  const getPhaseIcon = (status) => {
    const icons = {
      'not_started': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'failed': '❌'
    };
    return icons[status] || '⏳';
  };

  // Get consolidated Phase 3 status (combines Phase 3 + Phase 4)
  const getConsolidatedPhase3Status = (status) => {
    if (!status) return 'not_started';
    const phase3Status = status.phase3?.status || status.phase3 || 'not_started';
    const phase4Status = status.phase4?.status || status.phase4 || 'not_started';

    // Failed if either phase failed
    if (phase3Status === 'failed' || phase4Status === 'failed') return 'failed';
    // In progress if either phase is in progress
    if (phase3Status === 'in_progress' || phase4Status === 'in_progress') return 'in_progress';
    // Completed only if both are completed
    if (phase3Status === 'completed' && phase4Status === 'completed') return 'completed';
    // Otherwise not started
    return 'not_started';
  };

  const renderPhaseIndicators = (idrssd) => {
    const status = researchStatuses[idrssd];
    if (!status) {
      return <span className="text-xs text-muted-foreground">⏳⏳⏳ 📄🎙️📊</span>;
    }

    const phase1Status = status.phase1?.status || status.phase1 || 'not_started';
    const phase2Status = status.phase2?.status || status.phase2 || 'not_started';
    const phase3Status = getConsolidatedPhase3Status(status);

    // Check for outputs (from status.details if available)
    const hasReport = status.details?.phase2?.reportId || phase2Status === 'completed';
    const hasPodcast = status.details?.phase4?.podcastGenerated || status.phase4?.status === 'completed';
    const hasPresentation = status.details?.phase4?.presentationGenerated;

    return (
      <div className="flex gap-2 items-center justify-end">
        {/* Phase indicators */}
        <div className="flex gap-1">
          <span title="Phase 1: Gather Sources">{getPhaseIcon(phase1Status)}</span>
          <span title="Phase 2: Generate Report">{getPhaseIcon(phase2Status)}</span>
          <span title="Phase 3: Generate Outputs">{getPhaseIcon(phase3Status)}</span>
        </div>
        {/* Output indicators */}
        <div className="flex gap-1">
          <span title={hasReport ? "Research Report Available" : "Research Report Not Available"} style={{opacity: hasReport ? 1 : 0.3}}>📄</span>
          <span title={hasPodcast ? "Podcast Available" : "Podcast Not Available"} style={{opacity: hasPodcast ? 1 : 0.3}}>🎙️</span>
          <span title={hasPresentation ? "Presentation Available" : "Presentation Not Available"} style={{opacity: hasPresentation ? 1 : 0.3}}>📊</span>
        </div>
      </div>
    );
  };

  const handleBankSelect = (bank) => {
    navigate(`/bank/${bank.idrssd}`);
    setShowDropdown(false);
    setInputValue('');
  };

  return (
    <div className="space-y-4">
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bank Explorer</CardTitle>
          <CardDescription>
            Search by name or browse the top 100 banks by total assets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g., JPMorgan, Wells Fargo"
                className="pl-10"
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && options.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-96 overflow-y-auto">
                {options.map((bank) => (
                  <div
                    key={bank.idrssd}
                    onClick={() => handleBankSelect(bank)}
                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BankLogo idrssd={bank.idrssd} bankName={bank.name} size="sm" />
                      <div>
                        <p className="font-medium text-sm">{bank.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bank.city}, {bank.state}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-primary">
                      {formatAssets(bank.totalAssets)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showDropdown && inputValue.length >= 2 && options.length === 0 && !loading && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg p-3 text-sm text-muted-foreground">
                No banks found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top 100 Banks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top 100 Banks by Total Assets</CardTitle>
          <CardDescription>
            Click any row to view detailed financial statements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topBanksLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Institution Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Total Assets</TableHead>
                    <TableHead className="text-right">Net Income</TableHead>
                    <TableHead className="text-right">ROE %</TableHead>
                    <TableHead className="text-right">Eff. Ratio %</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Research Phase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topBanks.map((bank, index) => (
                    <TableRow
                      key={bank.idrssd}
                      onClick={() => navigate(`/bank/${bank.idrssd}`)}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BankLogo idrssd={bank.idrssd} bankName={bank.name} size="sm" />
                          <span className="font-medium">{bank.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {bank.city}, {bank.state}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatAssets(bank.totalAssets)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {bank.netIncome ? `$${(bank.netIncome / 1000).toFixed(1)}M` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {bank.roe ? bank.roe.toFixed(2) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {bank.efficiencyRatio ? bank.efficiencyRatio.toFixed(1) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {bank.fullTimeEquivalentEmployees || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {renderPhaseIndicators(bank.idrssd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BankSearch;
