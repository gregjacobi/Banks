import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Loader2, ChevronDown, ChevronUp, Play, BarChart3, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

/**
 * Custom Multi-Select Dropdown Component
 */
function MultiSelect({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = (options || []).filter(option =>
    option.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const safeValue = value || [];

  const handleToggleOption = (option) => {
    const isSelected = safeValue.some(v => v.idrssd === option.idrssd);
    if (isSelected) {
      onChange(safeValue.filter(v => v.idrssd !== option.idrssd));
    } else {
      onChange([...safeValue, option]);
    }
  };

  const handleRemoveItem = (option, e) => {
    e.stopPropagation();
    onChange(safeValue.filter(v => v.idrssd !== option.idrssd));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="min-h-[42px] w-full rounded-md border border-[#3e3e42] bg-[#2d2d30] px-3 py-2 text-sm text-white cursor-pointer hover:bg-[#3e3e42] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {safeValue.length === 0 ? (
          <span className="text-[#969696]">{placeholder}</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {safeValue.map(option => (
              <span
                key={option.idrssd}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-[#d97757]/20 text-[#d97757] border border-[#d97757]/30"
              >
                {option.name}
                <button
                  onClick={(e) => handleRemoveItem(option, e)}
                  className="hover:bg-[#d97757]/30 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-[#3e3e42] bg-[#2d2d30] shadow-lg">
          <div className="p-2 border-b border-[#3e3e42]">
            <Input
              type="text"
              placeholder="Search banks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 bg-[#1e1e1e] border-[#3e3e42] text-white"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#969696]">No banks found</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = safeValue.some(v => v.idrssd === option.idrssd);
                return (
                  <div
                    key={option.idrssd}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-[#3e3e42] ${
                      isSelected ? 'bg-[#d97757]/10 text-[#d97757]' : 'text-white'
                    }`}
                    onClick={() => handleToggleOption(option)}
                  >
                    {option.name}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Custom Select Dropdown Component
 */
function CustomSelect({ options, value, onChange, placeholder, disabled, renderValue }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayValue = renderValue ? renderValue(value) : value;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className={`w-full min-h-[42px] rounded-md border border-[#3e3e42] bg-[#2d2d30] px-3 py-2 text-sm text-left transition-colors ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-[#3e3e42] cursor-pointer'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={value ? 'text-white' : 'text-[#969696]'}>
          {displayValue || placeholder}
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-[#3e3e42] bg-[#2d2d30] shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[#969696]">No options available</div>
          ) : (
            options.map((option) => (
              <div
                key={option.value}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-[#3e3e42] ${
                  value === option.value ? 'bg-[#d97757]/10 text-[#d97757]' : 'text-white'
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Expandable Row Component
 */
function BankComparisonRow({ comparison }) {
  const [open, setOpen] = useState(false);

  const getVarianceColor = (status) => {
    switch (status) {
      case 'match': return 'text-green-600';
      case 'acceptable': return 'text-yellow-600';
      case 'warning': return 'text-orange-600';
      case 'significant': return 'text-red-600';
      default: return 'text-[#969696]';
    }
  };

  const getVarianceColorBg = (status) => {
    switch (status) {
      case 'match': return 'bg-green-600/10 text-green-600 border-green-600/30';
      case 'acceptable': return 'bg-yellow-600/10 text-yellow-600 border-yellow-600/30';
      case 'warning': return 'bg-orange-600/10 text-orange-600 border-orange-600/30';
      case 'significant': return 'bg-red-600/10 text-red-600 border-red-600/30';
      default: return 'bg-[#3e3e42]/10 text-[#969696] border-[#3e3e42]/30';
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return typeof value === 'number' ? value.toFixed(2) : value;
  };

  const formatLargeNumber = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatFieldLabel = (key) => {
    // Special cases for better readability
    const labelMap = {
      avgTotalAssets: 'Avg Total Assets',
      avgTotalEquity: 'Avg Total Equity',
      avgEarningAssets: 'Avg Earning Assets',
      totalAssets: 'Total Assets',
      totalLoans: 'Total Loans',
      totalSecurities: 'Total Securities',
      totalDeposits: 'Total Deposits',
      totalEquity: 'Total Equity',
      cashAndDue: 'Cash and Due from Banks',
      interestIncome: 'Interest Income',
      interestExpense: 'Interest Expense',
      netInterestIncome: 'Net Interest Income',
      provisionForLosses: 'Provision for Losses',
      noninterestIncome: 'Noninterest Income',
      noninterestExpense: 'Noninterest Expense',
      netIncome: 'Net Income'
    };

    return labelMap[key] || key.replace(/([A-Z])/g, ' $1').trim();
  };

  const worstStatus = ['significant', 'warning', 'acceptable', 'match'].find(status =>
    Object.values(comparison.differences || {}).some(d => d.status === status)
  ) || 'match';

  return (
    <>
      <TableRow className="hover:bg-[#3e3e42]">
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            className="h-8 w-8 p-0"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{comparison.bankName}</TableCell>
        <TableCell className="text-right">{formatValue(comparison.ourMetrics?.roa)}</TableCell>
        <TableCell className={`text-right ${getVarianceColor(comparison.differences?.roa?.status)}`}>
          {formatValue(comparison.differences?.roa?.percent)}%
        </TableCell>
        <TableCell className="text-right">{formatValue(comparison.ourMetrics?.roe)}</TableCell>
        <TableCell className={`text-right ${getVarianceColor(comparison.differences?.roe?.status)}`}>
          {formatValue(comparison.differences?.roe?.percent)}%
        </TableCell>
        <TableCell className="text-right">{formatValue(comparison.ourMetrics?.nim)}</TableCell>
        <TableCell className={`text-right ${getVarianceColor(comparison.differences?.nim?.status)}`}>
          {formatValue(comparison.differences?.nim?.percent)}%
        </TableCell>
        <TableCell className="text-right">{formatValue(comparison.ourMetrics?.efficiencyRatio)}</TableCell>
        <TableCell className={`text-right ${getVarianceColor(comparison.differences?.efficiencyRatio?.status)}`}>
          {formatValue(comparison.differences?.efficiencyRatio?.percent)}%
        </TableCell>
        <TableCell className="text-center">
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${getVarianceColorBg(worstStatus)}`}>
            {worstStatus}
          </span>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={11} className="p-0">
            <div className="p-4 bg-[#1e1e1e]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Balance Sheet Items */}
                <div>
                  <h3 className="text-base font-semibold mb-2">Balance Sheet Items</h3>
                  <div className="rounded-md border border-[#3e3e42] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#3e3e42] hover:bg-[#3e3e42]">
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs text-right">Our Value</TableHead>
                          <TableHead className="text-xs text-right">UBPR Value</TableHead>
                          <TableHead className="text-xs text-right">PDF Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparison.balanceSheetItems && Object.entries(comparison.balanceSheetItems.our || {}).map(([key, ourValue]) => {
                          const ubprValue = comparison.balanceSheetItems.ubpr?.[key];
                          const pdfValue = comparison.pdfBalanceSheet?.[key];

                          return (
                            <TableRow key={key} className="hover:bg-[#2d2d30]">
                              <TableCell className="text-xs">
                                {formatFieldLabel(key)}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {formatLargeNumber(ourValue)}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {formatLargeNumber(ubprValue)}
                              </TableCell>
                              <TableCell className={`text-xs text-right ${pdfValue ? '' : 'italic text-[#969696]'}`}>
                                {pdfValue ? formatLargeNumber(pdfValue) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {comparison.pdfNote && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-[#969696] italic">
                        PDF: {comparison.pdfNote}
                        {comparison.pdfConfidence && ` (${comparison.pdfConfidence} confidence)`}
                      </p>
                      {comparison.pdfPeriod && (
                        <p className="text-xs text-[#969696] italic">
                          PDF Period: {comparison.pdfPeriod} (Q{comparison.pdfQuarter})
                          {comparison.pdfIncomeStatementBasis && ` • Income basis: ${comparison.pdfIncomeStatementBasis}`}
                          {comparison.pdfMetricsBasis && ` • Metrics basis: ${comparison.pdfMetricsBasis}`}
                        </p>
                      )}
                      {comparison.pdfWarnings && comparison.pdfWarnings.length > 0 && (
                        <p className="text-xs text-yellow-600 italic">
                          ⚠ {comparison.pdfWarnings.join(' • ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Income Statement Items */}
                <div>
                  <h3 className="text-base font-semibold mb-2">Income Statement Items</h3>
                  <div className="rounded-md border border-[#3e3e42] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#3e3e42] hover:bg-[#3e3e42]">
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs text-right">Our Value</TableHead>
                          <TableHead className="text-xs text-right">UBPR Value</TableHead>
                          <TableHead className="text-xs text-right">PDF Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparison.incomeStatementItems && Object.entries(comparison.incomeStatementItems.our || {}).map(([key, ourValue]) => {
                          const ubprValue = comparison.incomeStatementItems.ubpr?.[key];
                          const pdfValue = comparison.pdfIncomeStatement?.[key];

                          return (
                            <TableRow key={key} className="hover:bg-[#2d2d30]">
                              <TableCell className="text-xs">
                                {formatFieldLabel(key)}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {formatLargeNumber(ourValue)}
                              </TableCell>
                              <TableCell className="text-xs text-right">
                                {formatLargeNumber(ubprValue)}
                              </TableCell>
                              <TableCell className={`text-xs text-right ${pdfValue ? '' : 'italic text-[#969696]'}`}>
                                {pdfValue ? formatLargeNumber(pdfValue) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {comparison.pdfSources && comparison.pdfSources.length > 0 && (
                    <p className="mt-2 text-xs text-[#969696] italic">
                      Sources: {comparison.pdfSources.join(', ')}
                    </p>
                  )}
                </div>

                {/* Formula Breakdown */}
                <div className="md:col-span-2">
                  <h3 className="text-base font-semibold mb-2 mt-4">Formula Breakdown</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {comparison.formulaBreakdown && Object.entries(comparison.formulaBreakdown).map(([metric, breakdown]) => (
                      <div key={metric} className="rounded-md border border-[#3e3e42] p-3 bg-[#2d2d30]">
                        <h4 className="text-sm font-semibold mb-1">
                          {metric.toUpperCase()}
                        </h4>
                        <p className="text-xs text-[#969696] italic mb-2">
                          {breakdown.our?.formula || breakdown.ubpr?.formula}
                        </p>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span><strong>Our:</strong> Numerator</span>
                            <span>{formatLargeNumber(breakdown.our?.numerator)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span><strong>Our:</strong> Denominator</span>
                            <span>{formatLargeNumber(breakdown.our?.denominator)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span><strong>UBPR:</strong> Numerator</span>
                            <span>{formatLargeNumber(breakdown.ubpr?.numerator)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span><strong>UBPR:</strong> Denominator</span>
                            <span>{formatLargeNumber(breakdown.ubpr?.denominator)}</span>
                          </div>
                          {breakdown.ubpr?.note && (
                            <p className="text-xs text-yellow-600 mt-2">
                              Note: {breakdown.ubpr.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Multi-Bank UBPR Validation Component
 */
function MultiBankUBPRValidation({ banks: propBanks }) {
  const [banks, setBanks] = useState(propBanks || []);
  const [loadingBanks, setLoadingBanks] = useState(!propBanks);
  const [selectedBanks, setSelectedBanks] = useState([]);
  const [period, setPeriod] = useState('');
  const [periods, setPeriods] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  // Fetch banks if not provided as prop
  useEffect(() => {
    if (propBanks) {
      setBanks(propBanks);
      setLoadingBanks(false);
      return;
    }

    const fetchBanks = async () => {
      try {
        setLoadingBanks(true);
        const response = await axios.get('/api/banks');
        const banksData = response.data?.banks || response.data || [];
        const bankList = banksData.map(bank => ({
          idrssd: bank.idrssd,
          name: bank.institutionName || bank.name || `Bank ${bank.idrssd}`
        }));
        setBanks(bankList);
      } catch (err) {
        console.error('Error fetching banks:', err);
        setError('Failed to load bank list');
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchBanks();
  }, [propBanks]);

  // Fetch available periods when banks are selected
  useEffect(() => {
    const fetchPeriods = async () => {
      if (selectedBanks.length === 0) {
        setPeriods([]);
        setPeriod('');
        return;
      }

      setLoadingPeriods(true);
      try {
        const idrssds = selectedBanks.map(b => b.idrssd).join(',');
        const response = await axios.get(`/api/banks/available-periods?idrssds=${idrssds}`);
        const fetchedPeriods = response.data.periods || [];
        setPeriods(fetchedPeriods);

        // Set period to most recent if available
        if (fetchedPeriods.length > 0) {
          setPeriod(prevPeriod => {
            // If current period is not in the list, set to most recent
            if (!fetchedPeriods.includes(prevPeriod)) {
              return fetchedPeriods[0];
            }
            return prevPeriod || fetchedPeriods[0];
          });
        } else {
          setPeriod('');
        }
      } catch (err) {
        console.error('Error fetching available periods:', err);
        setError('Failed to load available periods');
        setPeriods([]);
        setPeriod('');
      } finally {
        setLoadingPeriods(false);
      }
    };

    fetchPeriods();
  }, [selectedBanks]);

  const handleRunValidation = async () => {
    if (selectedBanks.length === 0) {
      setError('Please select at least one bank');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setAnalysis(null);

    try {
      const response = await axios.post('/api/ubpr/compare-batch', {
        idrssds: selectedBanks.map(b => b.idrssd),
        period
      });

      setResults(response.data);
    } catch (err) {
      console.error('Error running UBPR validation:', err);
      setError(err.response?.data?.error || 'Failed to run UBPR validation');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeIssues = async () => {
    if (!results) {
      setError('Please run validation first');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const response = await axios.post('/api/ubpr/analyze-issues', {
        results: results.comparisons,
        period
      });

      setAnalysis(response.data);
    } catch (err) {
      console.error('Error analyzing issues:', err);
      setError(err.response?.data?.error || 'Failed to analyze issues');
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const periodOptions = periods.map(p => ({
    value: p,
    label: formatDateForDisplay(p)
  }));

  return (
    <div className="space-y-6">
      <Card style={{ backgroundColor: '#2d2d30', borderColor: '#3e3e42' }}>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Multi-Bank UBPR Validation</CardTitle>
          <CardDescription className="text-[#969696]">
            Test and validate financial ratios across multiple banks to detect systematic calculation issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bank Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">
              Select Banks
            </label>
            {loadingBanks && (
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#d97757]" />
                <span className="text-xs text-[#969696]">Loading banks...</span>
              </div>
            )}
            <MultiSelect
              options={banks}
              value={selectedBanks}
              onChange={setSelectedBanks}
              placeholder={loadingBanks ? "Loading..." : "Choose banks to validate"}
            />
          </div>

          {/* Period Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">
              Reporting Period
            </label>
            {loadingPeriods && (
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#d97757]" />
                <span className="text-xs text-[#969696]">Loading available periods...</span>
              </div>
            )}
            <CustomSelect
              options={periodOptions}
              value={period}
              onChange={setPeriod}
              placeholder="Select reporting period"
              disabled={loadingPeriods || periods.length === 0}
              renderValue={formatDateForDisplay}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleRunValidation}
              disabled={loading || selectedBanks.length === 0}
              className="bg-[#d97757] hover:bg-[#c86647] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Validation
                </>
              )}
            </Button>

            {results && (
              <Button
                onClick={handleAnalyzeIssues}
                disabled={analyzing}
                variant="outline"
                className="border-[#3e3e42] text-white hover:bg-[#3e3e42]"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Analyze Issues
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="rounded-md border border-red-600/30 bg-red-600/10 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card style={{ backgroundColor: '#2d2d30', borderColor: '#3e3e42' }}>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">AI Analysis: Systematic Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysis.issues && analysis.issues.length > 0 ? (
              <>
                {analysis.issues.map((issue, index) => {
                  const severityColor = {
                    error: 'border-red-600/30 bg-red-600/10',
                    warning: 'border-yellow-600/30 bg-yellow-600/10',
                    info: 'border-blue-600/30 bg-blue-600/10',
                    success: 'border-green-600/30 bg-green-600/10'
                  }[issue.severity || 'info'];

                  const textColor = {
                    error: 'text-red-600',
                    warning: 'text-yellow-600',
                    info: 'text-blue-600',
                    success: 'text-green-600'
                  }[issue.severity || 'info'];

                  return (
                    <div key={index} className={`rounded-md border p-4 ${severityColor}`}>
                      <h3 className={`text-sm font-semibold mb-1 ${textColor}`}>{issue.title}</h3>
                      <p className={`text-sm ${textColor}`}>{issue.description}</p>
                      {issue.affectedBanks && issue.affectedBanks.length > 0 && (
                        <div className="mt-2">
                          <p className={`text-xs ${textColor}`}>
                            Affected: {issue.affectedBanks.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="rounded-md border border-green-600/30 bg-green-600/10 p-4">
                <h3 className="text-sm font-semibold mb-1 text-green-600">No Systematic Issues Detected</h3>
                <p className="text-sm text-green-600">
                  {analysis.summary || 'All calculations appear to be consistent across selected banks.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Results Table */}
      {results && (
        <Card style={{ backgroundColor: '#2d2d30', borderColor: '#3e3e42' }}>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Validation Results</CardTitle>
            <CardDescription className="text-[#969696]">
              Showing {results.comparisons?.length || 0} banks validated. Click row to expand details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-[#3e3e42] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#3e3e42] hover:bg-[#3e3e42]">
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead className="text-right">ROA</TableHead>
                    <TableHead className="text-right">Diff %</TableHead>
                    <TableHead className="text-right">ROE</TableHead>
                    <TableHead className="text-right">Diff %</TableHead>
                    <TableHead className="text-right">NIM</TableHead>
                    <TableHead className="text-right">Diff %</TableHead>
                    <TableHead className="text-right">Eff Ratio</TableHead>
                    <TableHead className="text-right">Diff %</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.comparisons && results.comparisons.map((comparison) => (
                    <BankComparisonRow key={comparison.idrssd} comparison={comparison} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default MultiBankUBPRValidation;
