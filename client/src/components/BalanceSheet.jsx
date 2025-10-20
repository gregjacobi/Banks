import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
  Box,
  Collapse,
  IconButton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Balance Sheet Display Component
 * Tufte-inspired: dense, minimal decoration, data-first
 * Two-column layout: Assets | Liabilities & Equity
 */
function BalanceSheet({ balanceSheet }) {
  const [loansExpanded, setLoansExpanded] = useState(false);

  if (!balanceSheet) {
    return <Typography>No balance sheet data available</Typography>;
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    // Values are in thousands
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value * 1000);
  };

  const { assets, liabilities, equity } = balanceSheet;
  const portfolio = assets?.earningAssets?.loansAndLeases?.portfolio;

  // Calculate loan categories (same as TrendsTabCompact)
  const calculateLoanCategories = () => {
    if (!portfolio) return null;

    // Consumer lending
    const residential = (portfolio.realEstate.securedBy1To4Family.revolvingOpenEnd || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndFirstLiens || 0) +
      (portfolio.realEstate.securedBy1To4Family.closedEndJuniorLiens || 0);
    const creditCards = portfolio.consumer.creditCards || 0;
    const auto = portfolio.consumer.automobileLoans || 0;
    const otherConsumer = (portfolio.consumer.otherRevolvingCredit || 0) + (portfolio.consumer.otherConsumerLoans || 0);
    const consumerTotal = residential + creditCards + auto + otherConsumer;

    // Business lending
    const commercialRE = (portfolio.realEstate.constructionAndLandDevelopment.total || 0) +
      (portfolio.realEstate.multifamily || 0) +
      (portfolio.realEstate.nonfarmNonresidential.ownerOccupied || 0) +
      (portfolio.realEstate.nonfarmNonresidential.otherNonfarmNonresidential || 0);
    const cniUS = portfolio.commercialAndIndustrial.usAddressees || 0;
    const cniNonUS = portfolio.commercialAndIndustrial.nonUsAddressees || 0;
    const agricultural = portfolio.other.agriculturalProduction || 0;
    const toDepository = portfolio.other.toDepositoryInstitutions || 0;

    // Other Specialized Loans - now part of Business Lending
    const foreignGovernments = portfolio.other.loansToForeignGovernments || 0;
    const municipalLoans = portfolio.other.municipalLoans || 0;
    const otherDepositoryUS = portfolio.other.loansToOtherDepositoryUS || 0;
    const banksForeign = portfolio.other.loansToBanksForeign || 0;
    const allOtherLoansRemainder = portfolio.other.allOtherLoans || 0;
    const otherSpecializedLoans = foreignGovernments + municipalLoans + otherDepositoryUS + banksForeign + allOtherLoansRemainder;

    const businessTotal = commercialRE + cniUS + cniNonUS + agricultural + toDepository + otherSpecializedLoans;

    // Lease financing
    const consumerLeases = portfolio.leaseFinancingReceivables?.consumerLeases || 0;
    const otherLeases = portfolio.leaseFinancingReceivables?.allOtherLeases || 0;
    const leasesTotal = consumerLeases + otherLeases;

    return {
      consumerTotal,
      residential,
      creditCards,
      auto,
      otherConsumer,
      businessTotal,
      commercialRE,
      cniUS,
      cniNonUS,
      agricultural,
      toDepository,
      otherSpecializedLoans,
      foreignGovernments,
      municipalLoans,
      otherDepositoryUS,
      banksForeign,
      allOtherLoansRemainder,
      leasesTotal,
      consumerLeases,
      otherLeases,
      grossTotal: consumerTotal + businessTotal + leasesTotal
    };
  };

  const loanCategories = calculateLoanCategories();

  return (
    <Box sx={{ maxWidth: 1000 }}>
      <TableContainer>
        <Table size="small">
          <TableBody>
            {/* Assets Section */}
            <TableRow>
              <TableCell colSpan={2} sx={{ backgroundColor: '#e3f2fd', fontWeight: 700, fontSize: '1.1rem', borderTop: '2px solid #1976d2' }}>
                ASSETS
              </TableCell>
            </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600 }}>
                  Earning Assets
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Loans & Leases (Gross)</TableCell>
                <TableCell align="right">
                  {formatCurrency(
                    assets.earningAssets.loansAndLeases.net +
                    (assets.earningAssets.loansAndLeases.netOfAllowance || 0)
                  )}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3, fontSize: '0.85rem', color: 'text.secondary' }}>
                  Less: Allowance for Loan Losses
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  ({formatCurrency(assets.earningAssets.loansAndLeases.netOfAllowance || 0)})
                </TableCell>
              </TableRow>
              <TableRow
                sx={{
                  cursor: portfolio ? 'pointer' : 'default',
                  '&:hover': portfolio ? { backgroundColor: '#fafafa' } : {}
                }}
                onClick={() => portfolio && setLoansExpanded(!loansExpanded)}
              >
                <TableCell sx={{ pl: 2, display: 'flex', alignItems: 'center' }}>
                  {portfolio && (
                    <IconButton size="small" sx={{ mr: 0.5, p: 0 }}>
                      {loansExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </IconButton>
                  )}
                  <span style={{ marginLeft: portfolio ? 0 : 8 }}>Loans & Leases (Net)</span>
                </TableCell>
                <TableCell align="right">{formatCurrency(assets.earningAssets.loansAndLeases.net)}</TableCell>
              </TableRow>

              {/* Expandable Loan Portfolio Detail */}
              {portfolio && (
                <TableRow>
                  <TableCell colSpan={2} sx={{ p: 0, borderBottom: 'none' }}>
                    <Collapse in={loansExpanded} timeout="auto" unmountOnExit>
                      <Table size="small">
                        <TableBody>
                          {/* Consumer Lending */}
                          {loanCategories.consumerTotal > 0 && (
                            <>
                              <TableRow>
                                <TableCell colSpan={2} sx={{ pl: 5, backgroundColor: '#f5f5f5', fontSize: '0.9rem', fontWeight: 600 }}>
                                  Consumer Lending
                                </TableCell>
                              </TableRow>
                              {loanCategories.residential > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Residential Mortgages (1-4 Family)</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.residential)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.creditCards > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Credit Cards</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.creditCards)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.auto > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Auto Loans</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.auto)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.otherConsumer > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Other Consumer</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.otherConsumer)}
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow>
                                <TableCell sx={{ pl: 5, fontSize: '0.9rem', fontWeight: 600, backgroundColor: '#f0f0f0' }}>
                                  Total Consumer Lending
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '0.9rem', fontWeight: 600, backgroundColor: '#f0f0f0' }}>
                                  {formatCurrency(loanCategories.consumerTotal)}
                                </TableCell>
                              </TableRow>
                            </>
                          )}

                          {/* Business Lending */}
                          {loanCategories.businessTotal > 0 && (
                            <>
                              <TableRow>
                                <TableCell colSpan={2} sx={{ pl: 5, backgroundColor: '#f5f5f5', fontSize: '0.9rem', fontWeight: 600, mt: 1 }}>
                                  Business Lending
                                </TableCell>
                              </TableRow>
                              {loanCategories.commercialRE > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Commercial Real Estate</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.commercialRE)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.cniUS > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>C&I (US)</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.cniUS)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.cniNonUS > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>C&I (Non-US)</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.cniNonUS)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.agricultural > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Agricultural</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.agricultural)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.toDepository > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>To Depository Institutions</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.toDepository)}
                                  </TableCell>
                                </TableRow>
                              )}

                              {/* Other Specialized Loans - Securities-based lending subcategory */}
                              {loanCategories.otherSpecializedLoans > 1000 && (
                                <>
                                  <TableRow>
                                    <TableCell sx={{ pl: 7, fontSize: '0.85rem', fontWeight: 600, pt: 1 }}>
                                      Other Specialized Loans
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600, pt: 1 }}>
                                      {formatCurrency(loanCategories.otherSpecializedLoans)}
                                    </TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell colSpan={2} sx={{ pl: 9, fontSize: '0.75rem', fontStyle: 'italic', color: 'text.secondary', pb: 0.5 }}>
                                      Securities-based lending, margin loans, and specialized institutional lending
                                    </TableCell>
                                  </TableRow>
                                  {loanCategories.foreignGovernments > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ pl: 9, fontSize: '0.8rem' }}>Loans to Foreign Governments</TableCell>
                                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                                        {formatCurrency(loanCategories.foreignGovernments)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {loanCategories.municipalLoans > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ pl: 9, fontSize: '0.8rem' }}>Municipal/State Obligations</TableCell>
                                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                                        {formatCurrency(loanCategories.municipalLoans)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {loanCategories.otherDepositoryUS > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ pl: 9, fontSize: '0.8rem' }}>Loans to Other Depository Inst (US)</TableCell>
                                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                                        {formatCurrency(loanCategories.otherDepositoryUS)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {loanCategories.banksForeign > 0 && (
                                    <TableRow>
                                      <TableCell sx={{ pl: 9, fontSize: '0.8rem' }}>Loans to Foreign Banks</TableCell>
                                      <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                                        {formatCurrency(loanCategories.banksForeign)}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                  {loanCategories.allOtherLoansRemainder > 0 && (
                                    <>
                                      <TableRow>
                                        <TableCell sx={{ pl: 9, fontSize: '0.8rem' }}>Other Specialized (Unspecified)</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '0.8rem' }}>
                                          {formatCurrency(loanCategories.allOtherLoansRemainder)}
                                        </TableCell>
                                      </TableRow>
                                      <TableRow>
                                        <TableCell colSpan={2} sx={{ pl: 11, fontSize: '0.7rem', fontStyle: 'italic', color: 'text.secondary' }}>
                                          Securities-based lending, acceptances, and other specialized financing
                                        </TableCell>
                                      </TableRow>
                                    </>
                                  )}
                                </>
                              )}

                              <TableRow>
                                <TableCell sx={{ pl: 5, fontSize: '0.9rem', fontWeight: 600, backgroundColor: '#f0f0f0' }}>
                                  Total Business Lending
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '0.9rem', fontWeight: 600, backgroundColor: '#f0f0f0' }}>
                                  {formatCurrency(loanCategories.businessTotal)}
                                </TableCell>
                              </TableRow>
                            </>
                          )}

                          {/* Lease Financing */}
                          {loanCategories.leasesTotal > 0 && (
                            <>
                              <TableRow>
                                <TableCell colSpan={2} sx={{ pl: 5, backgroundColor: '#f5f5f5', fontSize: '0.9rem', fontWeight: 600 }}>
                                  Lease Financing
                                </TableCell>
                              </TableRow>
                              {loanCategories.consumerLeases > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Consumer Leases</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.consumerLeases)}
                                  </TableCell>
                                </TableRow>
                              )}
                              {loanCategories.otherLeases > 0 && (
                                <TableRow>
                                  <TableCell sx={{ pl: 7, fontSize: '0.85rem' }}>Other Leases</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.85rem' }}>
                                    {formatCurrency(loanCategories.otherLeases)}
                                  </TableCell>
                                </TableRow>
                              )}
                              <TableRow>
                                <TableCell sx={{ pl: 5, fontSize: '0.9rem', fontWeight: 600, backgroundColor: '#f0f0f0' }}>
                                  Total Lease Financing
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '0.9rem', fontWeight: 600, backgroundColor: '#f0f0f0' }}>
                                  {formatCurrency(loanCategories.leasesTotal)}
                                </TableCell>
                              </TableRow>
                            </>
                          )}

                          {/* Gross Portfolio Total */}
                          <TableRow>
                            <TableCell sx={{ pl: 5, fontSize: '0.95rem', fontWeight: 700, backgroundColor: '#e8e8e8', borderTop: '2px solid #999' }}>
                              Gross Loan Portfolio
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '0.95rem', fontWeight: 700, backgroundColor: '#e8e8e8', borderTop: '2px solid #999' }}>
                              {formatCurrency(loanCategories.grossTotal)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Collapse>
                  </TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Securities (AFS)</TableCell>
                <TableCell align="right">{formatCurrency(assets.earningAssets.securities.availableForSale)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Securities (HTM)</TableCell>
                <TableCell align="right">{formatCurrency(assets.earningAssets.securities.heldToMaturity)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Interest-Bearing Balances</TableCell>
                <TableCell align="right">{formatCurrency(assets.earningAssets.interestBearingBankBalances)}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600 }}>
                  Nonearning Assets
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Cash & Due from Banks</TableCell>
                <TableCell align="right">{formatCurrency(assets.nonearningAssets.cashAndDueFromBanks)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Premises & Fixed Assets</TableCell>
                <TableCell align="right">{formatCurrency(assets.nonearningAssets.premisesAndFixedAssets)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Intangible Assets</TableCell>
                <TableCell align="right">{formatCurrency(assets.nonearningAssets.intangibleAssets)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Other Assets</TableCell>
                <TableCell align="right">{formatCurrency(assets.nonearningAssets.otherAssets)}</TableCell>
              </TableRow>

              <TableRow>
                <TableCell sx={{ fontWeight: 700, borderTop: '2px solid #1976d2', backgroundColor: '#e3f2fd' }}>
                  Total Assets
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, borderTop: '2px solid #1976d2', backgroundColor: '#e3f2fd' }}>
                  {formatCurrency(assets.totalAssets)}
                </TableCell>
              </TableRow>

              {/* Liabilities & Equity Section */}
              <TableRow>
                <TableCell colSpan={2} sx={{ backgroundColor: '#e3f2fd', fontWeight: 700, fontSize: '1.1rem', borderTop: '2px solid #1976d2', pt: 3 }}>
                  LIABILITIES & EQUITY
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600 }}>
                  Liabilities
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Total Deposits</TableCell>
                <TableCell align="right">{formatCurrency(liabilities.deposits.total)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 5, fontSize: '0.85rem', color: 'text.secondary' }}>
                  Non-Interest Bearing
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  {formatCurrency(liabilities.deposits.nonInterestBearing)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 5, fontSize: '0.85rem', color: 'text.secondary' }}>
                  Interest Bearing
                </TableCell>
                <TableCell align="right" sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                  {formatCurrency(liabilities.deposits.interestBearing)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Other Borrowed Money</TableCell>
                <TableCell align="right">{formatCurrency(liabilities.borrowings.otherBorrowedMoney)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Subordinated Debt</TableCell>
                <TableCell align="right">{formatCurrency(liabilities.borrowings.subordinatedDebt)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Other Liabilities</TableCell>
                <TableCell align="right">{formatCurrency(liabilities.otherLiabilities)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Total Liabilities</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatCurrency(liabilities.totalLiabilities)}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600, mt: 2 }}>
                  Equity
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Common Stock</TableCell>
                <TableCell align="right">{formatCurrency(equity.commonStock)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Surplus</TableCell>
                <TableCell align="right">{formatCurrency(equity.surplus)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Retained Earnings</TableCell>
                <TableCell align="right">{formatCurrency(equity.retainedEarnings)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Accumulated OCI</TableCell>
                <TableCell align="right">{formatCurrency(equity.accumulatedOCI)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Total Equity</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatCurrency(equity.totalEquity)}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    backgroundColor: '#e8f5e9',
                    borderTop: '2px solid #388e3c',
                    borderBottom: '2px solid #388e3c'
                  }}
                >
                  Total Liabilities & Equity
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    backgroundColor: '#e8f5e9',
                    borderTop: '2px solid #388e3c',
                    borderBottom: '2px solid #388e3c'
                  }}
                >
                  {formatCurrency(liabilities.totalLiabilities + equity.totalEquity)}
                </TableCell>
              </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default BalanceSheet;
