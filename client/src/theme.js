import { createTheme } from '@mui/material/styles';

/**
 * Anthropic Official Brand Theme
 * Using official Anthropic brand colors and guidelines
 * Tufte principles: minimal decoration, data-first design
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d97757', // Anthropic Orange (primary accent)
      light: '#e69578',
      dark: '#c25a39',
    },
    secondary: {
      main: '#6a9bcc', // Anthropic Blue (secondary accent)
      light: '#8fb3d9',
      dark: '#4a7aac',
    },
    background: {
      default: '#faf9f5', // Anthropic Light background
      paper: '#ffffff',
    },
    text: {
      primary: '#141413', // Anthropic Dark (primary text)
      secondary: '#b0aea5', // Anthropic Mid Gray
    },
    divider: '#e8e6dc', // Anthropic Light Gray
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
      fontSize: '2rem',
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.5rem',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.25rem',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
  },
  shape: {
    borderRadius: 12, // M3 rounded corners
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
        },
        elevation2: {
          boxShadow: '0 4px 8px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          // Tufte-inspired: minimal borders
          '& .MuiTableCell-root': {
            borderBottom: '1px solid #e0e0e0',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '12px 16px',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#fafafa',
        },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
        },
      },
    },
  },
});

export default theme;
