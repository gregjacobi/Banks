import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
  Box
} from '@mui/material';

/**
 * Income Statement Display Component
 * Tufte-inspired: cascading format, highlighting key metrics
 */
function IncomeStatement({ incomeStatement }) {
  if (!incomeStatement) {
    return <Typography>No income statement data available</Typography>;
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

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
        Income Statement
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600 }}>
                Interest Income
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Interest on Loans</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestIncome.loans)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Interest on Securities</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestIncome.securities)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Interest on Fed Funds</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestIncome.fedFunds)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Other Interest Income</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestIncome.other)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, pl: 3 }}>Total Interest Income</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatCurrency(incomeStatement.interestIncome.total)}
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600, pt: 2 }}>
                Interest Expense
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Interest on Deposits</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestExpense.deposits)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Interest on Borrowings</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestExpense.borrowings)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Interest on Subordinated Debt</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.interestExpense.subordinatedDebt)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, pl: 3 }}>Total Interest Expense</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatCurrency(incomeStatement.interestExpense.total)}
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  backgroundColor: '#e3f2fd',
                  borderTop: '2px solid #d97757',
                  borderBottom: '2px solid #d97757'
                }}
              >
                Net Interest Income
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  backgroundColor: '#e3f2fd',
                  borderTop: '2px solid #d97757',
                  borderBottom: '2px solid #d97757'
                }}
              >
                {formatCurrency(incomeStatement.netInterestIncome)}
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={{ pl: 2 }}>Provision for Credit Losses</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.provisionForCreditLosses)}</TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600, pt: 2 }}>
                Noninterest Income
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Service Fees</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.noninterestIncome.serviceFees)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Trading Revenue</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.noninterestIncome.tradingRevenue)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Other Noninterest Income</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.noninterestIncome.otherNoninterestIncome)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, pl: 3 }}>Total Noninterest Income</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatCurrency(incomeStatement.noninterestIncome.total)}
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell colSpan={2} sx={{ backgroundColor: '#fafafa', fontWeight: 600, pt: 2 }}>
                Noninterest Expense
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Salaries & Benefits</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.noninterestExpense.salariesAndBenefits)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Premises Expense</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.noninterestExpense.premisesExpense)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 3 }}>Other Noninterest Expense</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.noninterestExpense.other)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, pl: 3 }}>Total Noninterest Expense</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatCurrency(incomeStatement.noninterestExpense.total)}
              </TableCell>
            </TableRow>

            <TableRow>
              <TableCell sx={{ fontWeight: 600, pt: 2 }}>Income Before Taxes</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, pt: 2 }}>
                {formatCurrency(incomeStatement.incomeBeforeTaxes)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 2 }}>Applicable Taxes</TableCell>
              <TableCell align="right">{formatCurrency(incomeStatement.applicableTaxes)}</TableCell>
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
                Net Income
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
                {formatCurrency(incomeStatement.netIncome)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default IncomeStatement;
