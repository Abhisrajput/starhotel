import {
  AutoAwesome as SparkIcon, FactCheck as FactCheckIcon, LibraryBooks as LibraryIcon, Menu as MenuIcon,
  VerifiedUser as ShieldIcon, WorkOutline as WorkIcon,
} from '@mui/icons-material';
import { Avatar, Box, Drawer, IconButton, MenuItem, Select, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import EngagementPage from './pages/EngagementPage';
import EngagementsPage from './pages/EngagementsPage';
import LibraryPage from './pages/LibraryPage';
import ValidationPage from './pages/ValidationPage';
import { SessionProvider, useSession } from './session';
import { tokens } from './theme';

const SIDEBAR = 264;
const NAV = [
  { to: '/engagements', label: 'Engagements', icon: <WorkIcon fontSize="small" /> },
  { to: '/library', label: 'Content library', icon: <LibraryIcon fontSize="small" /> },
  { to: '/validation', label: 'Evaluation & validation', icon: <ShieldIcon fontSize="small" /> },
];

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Box sx={{ width: size, height: size, borderRadius: 2.5, display: 'grid', placeItems: 'center', backgroundImage: tokens.gradient, boxShadow: '0 8px 20px -8px rgba(79,70,229,.8)' }}>
      <FactCheckIcon sx={{ color: 'white', fontSize: size * 0.55 }} />
    </Box>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { provider } = useSession();
  return (
    <Stack sx={{ height: '100%', p: 2.5, color: 'rgba(255,255,255,.88)' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, mb: 4 }}>
        <BrandMark />
        <Box>
          <Typography sx={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, color: 'white', lineHeight: 1.1, fontSize: 17 }}>Audit & Controls</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)' }}>Agent Platform</Typography>
        </Box>
      </Stack>
      <Typography variant="overline" sx={{ px: 1.5, color: 'rgba(255,255,255,.4)', fontSize: 10.5 }}>
        Workspace
      </Typography>
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {NAV.map((n) => {
          const active = pathname.startsWith(n.to);
          return (
            <Box
              key={n.to}
              component={RouterLink}
              to={n.to}
              onClick={onNavigate}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.15, borderRadius: 2.5, textDecoration: 'none', fontSize: 14, fontWeight: 600,
                color: active ? 'white' : 'rgba(255,255,255,.65)',
                background: active ? 'linear-gradient(90deg, rgba(79,70,229,.45), rgba(14,165,164,.18))' : 'transparent',
                boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,.08)' : 'none',
                transition: 'all .15s ease',
                '&:hover': { color: 'white', background: active ? undefined : 'rgba(255,255,255,.05)' },
              }}
            >
              {n.icon}
              {n.label}
            </Box>
          );
        })}
      </Stack>
      <Box sx={{ flex: 1 }} />
      <Box sx={{ p: 2, borderRadius: 3, background: 'linear-gradient(160deg, rgba(79,70,229,.28), rgba(14,165,164,.14))', border: '1px solid rgba(255,255,255,.08)' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <SparkIcon sx={{ fontSize: 18, color: '#5EEAD4' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Drafting engine</Typography>
        </Stack>
        <Typography sx={{ fontSize: 12.5, mt: 0.75, color: 'rgba(255,255,255,.7)' }}>
          {provider ? (provider.id === 'offline' ? 'Deterministic rules (offline)' : provider.model) : '…'}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#34D399', boxShadow: '0 0 0 3px rgba(52,211,153,.2)' }} />
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>QA gates active on every output</Typography>
        </Stack>
      </Box>
    </Stack>
  );
}

function UserSwitcher() {
  const { users, user, setUserId } = useSession();
  return (
    <Select
      size="small"
      value={user?.id ?? ''}
      onChange={(e) => setUserId(String(e.target.value))}
      renderValue={() =>
        user && (
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, backgroundImage: tokens.gradient }}>
              {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
            </Avatar>
            <Box sx={{ lineHeight: 1.15, textAlign: 'left' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{user.name}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'capitalize' }}>Acting as {user.role}</Typography>
            </Box>
          </Stack>
        )
      }
      sx={{ minWidth: 220, '& .MuiSelect-select': { py: 0.75 } }}
    >
      {users.map((u) => (
        <MenuItem key={u.id} value={u.id}>
          {u.name} <Typography component="span" sx={{ ml: 1, color: 'text.secondary', fontSize: 13, textTransform: 'capitalize' }}>· {u.role}</Typography>
        </MenuItem>
      ))}
    </Select>
  );
}

function Shell() {
  const [open, setOpen] = useState(false);
  const sidebarSx = { width: SIDEBAR, bgcolor: tokens.ink, backgroundImage: `radial-gradient(600px 300px at -10% -10%, rgba(79,70,229,.35), transparent 60%), radial-gradient(500px 300px at 120% 110%, rgba(14,165,164,.22), transparent 60%)`, border: 0 };
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: SIDEBAR }, flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
        <Box sx={{ ...sidebarSx, position: 'fixed', inset: '0 auto 0 0' }}>
          <SidebarContent />
        </Box>
      </Box>
      <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { ...sidebarSx, borderRadius: 0 } }} sx={{ display: { md: 'none' } }}>
        <SidebarContent onNavigate={() => setOpen(false)} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'saturate(180%) blur(12px)', bgcolor: 'rgba(245,247,251,.8)', borderBottom: `1px solid ${tokens.border}` }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 2, md: 4 }, py: 1.5 }}>
            <IconButton sx={{ display: { md: 'none' } }} onClick={() => setOpen(true)}>
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
              <BrandMark size={30} />
            </Box>
            <Box sx={{ flex: 1 }} />
            <UserSwitcher />
          </Stack>
        </Box>
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 }, maxWidth: 1480, mx: 'auto' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/engagements" />} />
            <Route path="/engagements" element={<EngagementsPage />} />
            <Route path="/engagements/:id" element={<EngagementPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/validation" element={<ValidationPage />} />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
