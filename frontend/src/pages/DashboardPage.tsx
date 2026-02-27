import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roomsApi } from '../utils/api';
import { useSocket } from '../hooks/useSocket';
import {
  Box, Typography, Button, Grid, Chip, Stack, AppBar, Toolbar, IconButton, Menu, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

// Status colors matching legacy VB6 colors
const STATUS_COLORS: Record<string, string> = {
  Open: '#76E600',
  Booked: '#FFEA00',
  Occupied: '#FF1744',
  Housekeeping: '#D500F9',
  Maintenance: '#2979FF',
};

interface RoomData {
  id: number;
  roomShortName: string;
  roomType: string;
  roomStatus: string;
  roomLocation: string;
  roomPrice: number;
  active: boolean;
  alert: boolean;
}

/** Maps to legacy frmDashboard.frm — Room grid with status colors and context menu */
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { dashboardData, refresh } = useSocket();
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [summary, setSummary] = useState({ open: 0, booked: 0, occupied: 0, housekeeping: 0, maintenance: 0 });
  const [loading, setLoading] = useState(true);
  const [blinkOn, setBlinkOn] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ room: RoomData; anchorEl: HTMLElement } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ room: RoomData; newStatus: string } | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await roomsApi.getDashboardStatus();
      setRooms(data.rooms || []);
      setSummary(data.summary || summary);
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Use Socket.IO data when available — BR-15
  useEffect(() => {
    if (dashboardData) {
      setRooms(dashboardData.rooms || []);
      setSummary(dashboardData.summary || summary);
    }
  }, [dashboardData]);

  // BR-15: Blink animation for alert rooms
  useEffect(() => {
    const interval = setInterval(() => setBlinkOn(prev => !prev), 500);
    return () => clearInterval(interval);
  }, []);

  const handleRoomClick = (room: RoomData) => {
    if (room.roomStatus === 'Maintenance') {
      alert('Room is under Maintenance. Please choose other Room.');
      return;
    }
    navigate(`/booking/${room.id}`);
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLButtonElement>, room: RoomData) => {
    e.preventDefault();
    setContextMenu({ room, anchorEl: e.currentTarget });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!contextMenu) return;
    setContextMenu(null);
    try {
      await roomsApi.updateStatus(contextMenu.room.id, newStatus);
      await fetchRooms();
      refresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  // Group rooms by location
  const roomsByLocation = rooms.reduce<Record<string, RoomData[]>>((acc, room) => {
    if (!room.active) return acc;
    const loc = room.roomLocation || 'Unknown';
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(room);
    return acc;
  }, {});

  if (loading) {
    return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#505050' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#505050' }}>
        <Toolbar>
          <Typography variant="h5" fontWeight="bold" sx={{ flexGrow: 1 }}>
            ⭐ Hotel Booking System
          </Typography>
          <Typography variant="body2" color="secondary" sx={{ mr: 2 }}>
            User: {user?.userId}
          </Typography>
          <IconButton color="inherit" onClick={() => navigate('/reports')} title="Reports">
            <AssessmentIcon />
          </IconButton>
          {user?.userGroup === 1 && (
            <IconButton color="inherit" onClick={() => navigate('/admin')} title="Admin">
              <AdminPanelSettingsIcon />
            </IconButton>
          )}
          <IconButton color="inherit" onClick={() => { fetchRooms(); refresh(); }} title="Refresh">
            <RefreshIcon />
          </IconButton>
          <IconButton color="inherit" onClick={logout} title="Logout">
            <LogoutIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Summary bar */}
      <Stack direction="row" spacing={2} sx={{ p: 2, bgcolor: '#303030' }} justifyContent="center">
        {Object.entries(summary).map(([status, count]) => (
          <Chip
            key={status}
            label={`${status.charAt(0).toUpperCase() + status.slice(1)}: ${count}`}
            sx={{ bgcolor: STATUS_COLORS[status.charAt(0).toUpperCase() + status.slice(1)] || '#505050', color: '#000', fontWeight: 'bold' }}
          />
        ))}
      </Stack>

      {/* Room Grid — grouped by location (level) */}
      <Box sx={{ p: 2 }}>
        {Object.entries(roomsByLocation).map(([location, locationRooms]) => (
          <Box key={location} sx={{ mb: 3, bgcolor: '#303030', borderRadius: 1, p: 2 }}>
            <Typography variant="subtitle1" color="text.secondary" fontWeight="bold" mb={1}>
              {location}
            </Typography>
            <Grid container spacing={1}>
              {locationRooms.map((room) => {
                const isAlert = room.alert;
                const shouldDim = isAlert && !blinkOn;
                return (
                  <Grid item key={room.id}>
                    <Button
                      variant="contained"
                      onClick={() => handleRoomClick(room)}
                      onContextMenu={(e) => handleContextMenu(e, room)}
                      sx={{
                        width: 110, height: 80,
                        bgcolor: shouldDim ? '#505050' : (STATUS_COLORS[room.roomStatus] || '#505050'),
                        color: '#000', fontWeight: 'bold', fontSize: '0.75rem',
                        display: 'flex', flexDirection: 'column',
                        textTransform: 'none',
                        '&:hover': { opacity: 0.85, bgcolor: STATUS_COLORS[room.roomStatus] || '#606060' },
                      }}
                    >
                      <span style={{ fontWeight: 'bold' }}>{room.roomShortName}</span>
                      <span style={{ fontSize: '0.6rem' }}>{room.roomType}</span>
                    </Button>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        ))}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={contextMenu?.anchorEl}
        open={!!contextMenu}
        onClose={() => setContextMenu(null)}
      >
        <MenuItem disabled sx={{ fontWeight: 'bold' }}>
          {contextMenu?.room.roomShortName} — {contextMenu?.room.roomStatus}
        </MenuItem>
        {contextMenu?.room.roomStatus === 'Open' && (
          <MenuItem onClick={() => handleRoomClick(contextMenu!.room)}>Book Room</MenuItem>
        )}
        {contextMenu?.room.roomStatus === 'Housekeeping' && (
          <>
            <MenuItem onClick={() => handleStatusChange('Open')}>Set Free (Open)</MenuItem>
            <MenuItem onClick={() => handleStatusChange('Maintenance')}>Set Maintenance</MenuItem>
          </>
        )}
        {contextMenu?.room.roomStatus === 'Maintenance' && (
          <MenuItem onClick={() => handleStatusChange('Open')}>Set Free (Open)</MenuItem>
        )}
        {contextMenu?.room.roomStatus === 'Open' && (
          <>
            <MenuItem onClick={() => handleStatusChange('Housekeeping')}>Set Housekeeping</MenuItem>
            <MenuItem onClick={() => handleStatusChange('Maintenance')}>Set Maintenance</MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
}