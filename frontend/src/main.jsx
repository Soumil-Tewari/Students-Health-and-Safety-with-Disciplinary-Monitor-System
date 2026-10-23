import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import App from './App.jsx';
const theme = createTheme({ palette: { primary: { main: '#2563eb' }, background: { default: '#f4f6fb' } }, shape: { borderRadius: 10 } });
createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={theme}><CssBaseline /><BrowserRouter><App /></BrowserRouter></ThemeProvider>);
