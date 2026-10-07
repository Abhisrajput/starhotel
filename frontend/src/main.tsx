import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const theme = createTheme({
  palette: { primary: { main: '#1f4e79' }, secondary: { main: '#2e7d32' }, background: { default: '#f5f7fa' } },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
