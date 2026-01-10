import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Box, ThemeProvider, createTheme, CssBaseline, 
  Container, Typography, Paper, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, 
  Button, TextField, Chip, AppBar, Toolbar 
} from '@mui/material';
import { Shield, Zap, Terminal, Settings } from 'lucide-react';

// --- 1. Industry Standard Dark Theme Configuration ---
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#10b981' }, // Emerald Green
    background: { default: '#020202', paper: '#0a0a0a' },
    text: { primary: '#ffffff', secondary: '#94a3b8' },
  },
  typography: {
    fontFamily: "'JetBrains Mono', monospace",
  },
});

function App() {
  const [logs, setLogs] = useState([]);
  const [showAdmin, setShowAdmin] = useState(false);

  // --- 2. Data Fetching Logic ---
  const fetchLogs = async () => {
    try {
      const response = await axios.post('http://localhost:4000/', {
        query: `{ getLogs { id originalText riskLevel createdAt threatsFound } }`
      });
      setLogs(response.data.data.getLogs || []);
    } catch (err) { console.error("Neural Link Offline..."); }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Ye white screen ko black mein convert kar deta hai */}
      
      <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
        {/* --- Navbar --- */}
        <AppBar position="static" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid #1e293b' }} elevation={0}>
          <Toolbar>
            <Shield size={24} color="#10b981" style={{ marginRight: '12px' }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', letterSpacing: -1 }}>
              SENTINEL<span style={{ color: '#10b981' }}>GRAPH</span> <small style={{ fontSize: '10px', color: '#444' }}>v3.0</small>
            </Typography>
            <Button color="inherit" onClick={() => setShowAdmin(!showAdmin)} startIcon={<Settings size={18} />}>
              Engine_Config
            </Button>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4 }}>
          {/* --- Pattern Manager (MUI Framework Style) --- */}
          {showAdmin && (
            <Paper sx={{ p: 3, mb: 4, border: '1px solid #10b98144', bgcolor: '#050505' }}>
              <Typography variant="overline" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Zap size={14} /> Neural_Signature_Injection
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <TextField fullWidth size="small" label="Signature Name" variant="outlined" />
                <TextField fullWidth size="small" label="Regex Pattern" variant="outlined" />
                <Button variant="contained" sx={{ px: 4, fontWeight: 'bold' }}>Sync</Button>
              </Box>
            </Paper>
          )}

          {/* --- Live Feed Table (Standard Enterprise Grid) --- */}
          <TableContainer component={Paper} sx={{ border: '1px solid #1e293b' }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #1e293b' }}>
              <Terminal size={18} color="#10b981" />
              <Typography variant="subtitle2">LIVE_THREAT_DETECTION_STREAM</Typography>
            </Box>
            <Table sx={{ minWidth: 650 }}>
              <TableHead sx={{ bgcolor: '#0f172a' }}>
                <TableRow>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '12px' }}>TIMESTAMP</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '12px' }}>PAYLOAD_PREVIEW</TableCell>
                  <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '12px' }}>RISK_LEVEL</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length > 0 ? logs.map((log) => (
                  <TableRow key={log.id} sx={{ '&:hover': { bgcolor: '#111' }, borderBottom: '1px solid #111' }}>
                    <TableCell sx={{ fontSize: '12px', color: '#444' }}>
                      {new Date(parseInt(log.createdAt)).toLocaleTimeString()}
                    </TableCell>
                    <TableCell sx={{ color: '#cbd5e1' }}>{log.originalText.substring(0, 80)}...</TableCell>
                    <TableCell align="right">
                      <Chip 
                        label={log.riskLevel} 
                        size="small" 
                        color={log.riskLevel === 'SAFE' ? 'success' : 'error'} 
                        variant="outlined"
                        sx={{ fontSize: '10px', fontWeight: 'bold' }}
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 10, color: '#334155' }}>
                      Listening for incoming neural packets...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
