import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

function IncomeExpenseTab({ idrssd, availablePeriods }) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchAllPeriods = async () => {
      setLoading(true);
      try {
        const requests = availablePeriods.map(period =>
          axios.get(`/api/banks/${idrssd}?period=${period}`)
        );
        const responses = await Promise.all(requests);

        // Sort by period (oldest first for proper time-based chart ordering)
        const sortedStatements = responses
          .map(response => response.data.financialStatement)
          .filter(stmt => stmt != null)
          .sort((a, b) => new Date(a.reportingPeriod) - new Date(b.reportingPeriod));

        const data = sortedStatements.map(stmt => {
            const date = new Date(stmt.reportingPeriod);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const quarter = Math.ceil(month / 3);
            const label = `${year} Q${quarter}`;

            return {
              period: label,
              fullDate: stmt.reportingPeriod,
              // Income breakdown (in millions)
              netInterestIncome: (stmt.incomeStatement.netInterestIncome / 1000).toFixed(1),
              noninterestIncome: (stmt.incomeStatement.noninterestIncome.total / 1000).toFixed(1),
              // Expense breakdown (in millions)
              salariesAndBenefits: (stmt.incomeStatement.noninterestExpense.salariesAndBenefits / 1000).toFixed(1),
              premisesExpense: (stmt.incomeStatement.noninterestExpense.premisesExpense / 1000).toFixed(1),
              otherExpenses: (stmt.incomeStatement.noninterestExpense.other / 1000).toFixed(1),
              totalExpenses: (stmt.incomeStatement.noninterestExpense.total / 1000).toFixed(1)
            };
          });

        setChartData(data);
      } catch (error) {
        console.error('Error fetching period data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (availablePeriods?.length > 0) {
      fetchAllPeriods();
    }
  }, [idrssd, availablePeriods]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
        INCOME & EXPENSE ANALYSIS
      </Typography>

      <Grid container spacing={3}>
        {/* Interest vs Non-Interest Income */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Interest Income vs. Non-Interest Income
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Net interest income from lending activities compared to fee income and other revenue sources (YTD cumulative in millions)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis label={{ value: 'Amount ($M)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `$${value}M`} />
                <Legend />
                <Bar dataKey="netInterestIncome" fill="#1976d2" name="Net Interest Income" />
                <Bar dataKey="noninterestIncome" fill="#82ca9d" name="Non-Interest Income" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Operating Expenses Breakdown */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Operating Expenses Breakdown
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Non-interest expenses by category: personnel costs, facilities, and other operational expenses (YTD cumulative in millions)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis label={{ value: 'Amount ($M)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `$${value}M`} />
                <Legend />
                <Bar dataKey="salariesAndBenefits" stackId="expenses" fill="#ff8042" name="Salaries & Benefits" />
                <Bar dataKey="premisesExpense" stackId="expenses" fill="#ffbb28" name="Premises Expense" />
                <Bar dataKey="otherExpenses" stackId="expenses" fill="#8884d8" name="Other Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Total Expenses Trend */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Total Operating Expenses Trend
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Total non-interest expenses over time (YTD cumulative in millions)
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis label={{ value: 'Amount ($M)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `$${value}M`} />
                <Legend />
                <Line type="monotone" dataKey="totalExpenses" stroke="#ff8042" strokeWidth={2} name="Total Expenses" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default IncomeExpenseTab;
