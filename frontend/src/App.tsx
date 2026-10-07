import { FactCheck as FactCheckIcon } from '@mui/icons-material';
import { AppBar, Box, Button, Chip, Container, MenuItem, TextField, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import EngagementPage from './pages/EngagementPage';
import EngagementsPage from './pages/EngagementsPage';
import LibraryPage from './pages/LibraryPage';
import ValidationPage from './pages/ValidationPage';
import { SessionProvider, useSession } from './session';

function Shell() {
  const { users, user, setUserId, provider } = useSession();
  const { pathname } = useLocation();
  const nav = [
    { to: '/engagements', label: 'Engagements' },
    { to: '/library', label: 'Content library' },
    { to: '/validation', label: 'Evaluation & validation' },
  ];
  return (
    <>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <FactCheckIcon />
          <Typography variant="h6" sx={{ mr: 2, fontWeight: 600 }}>
            Audit & Controls Platform
          </Typography>
          {nav.map((n) => (
            <Button key={n.to} component={RouterLink} to={n.to} color="inherit" sx={{ opacity: pathname.startsWith(n.to) ? 1 : 0.7, fontWeight: pathname.startsWith(n.to) ? 700 : 400 }}>
              {n.label}
            </Button>
          ))}
          <Box sx={{ flex: 1 }} />
          {provider && <Chip size="small" label={`Model: ${provider.id === 'offline' ? 'offline rules' : provider.model}`} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'inherit' }} />}
          <TextField
            select
            size="small"
            value={user?.id ?? ''}
            onChange={(e) => setUserId(e.target.value)}
            sx={{ minWidth: 220, bgcolor: 'white', borderRadius: 1 }}
            label="Acting as"
          >
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name} ({u.role})
              </MenuItem>
            ))}
          </TextField>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/engagements" />} />
          <Route path="/engagements" element={<EngagementsPage />} />
          <Route path="/engagements/:id" element={<EngagementPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/validation" element={<ValidationPage />} />
        </Routes>
      </Container>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
