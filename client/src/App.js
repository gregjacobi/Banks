import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import theme from './theme';
import BankSearch from './components/BankSearch';
import BankDetail from './components/BankDetail';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', py: 4 }}>
          <Container maxWidth="lg">
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ mb: 4, fontWeight: 700 }}
            >
              Bank Explorer
            </Typography>

            <Routes>
              <Route path="/" element={<BankSearch />} />
              <Route path="/bank/:idrssd" element={<BankDetail />} />
            </Routes>
          </Container>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
