import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roomsApi, bookingsApi } from '../utils/api';
import {
  Box, Typography, TextField, Button, Grid, Card, CardContent, Select, MenuItem,
  FormControl, InputLabel, Alert, Stack, AppBar, Toolbar, IconButton, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const STATUS_COLORS: Record<string, string> = {
  Open: '#76E600', Booked: '#FFEA00', Occupied: '#FF1744',
  Housekeeping: '#D500F9', Maintenance: '#2979FF',
};

/** Maps to legacy frmBooking.frm — Full booking lifecycle form */
export default function BookingPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [room, setRoom] = useState<any>(null);
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [guestName, setGuestName] = useState('');
  const [guestPassport, setGuestPassport] = useState('');
  const [guestOrigin, setGuestOrigin] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [totalGuest, setTotalGuest] = useState(1);
  const [stayDuration, setStayDuration] = useState(1);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 16));
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().slice(0, 16));
  const [checkOutDate, setCheckOutDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [deposit, setDeposit] = useState(20); // BR-6
  const [payment, setPayment] = useState(0);
  const [refund, setRefund] = useState(0);

  useEffect(() => {
    loadRoom();
  }, [roomId]);

  // BR-5: Auto-calculate checkout date
  useEffect(() => {
    if (checkInDate && stayDuration) {
      const cin = new Date(checkInDate);
      const cinHour = cin.getHours();
      const daysToAdd = cinHour >= 12 ? stayDuration : stayDuration - 1;
      const cout = new Date(cin);
      cout.setDate(cout.getDate() + Math.max(daysToAdd, 0));
      cout.setHours(12, 0, 0, 0);
      setCheckOutDate(cout.toISOString().slice(0, 16));
    }
  }, [checkInDate, stayDuration]);

  const loadRoom = async () => {
    try {
      const roomData = await roomsApi.getById(parseInt(roomId!, 10));
      setRoom(roomData);

      // Check if there's an existing booking for this room
      if (roomData.bookingId > 0) {
        const booking = await bookingsApi.getById(roomData.bookingId);
        setExistingBooking(booking);
        populateFromBooking(booking);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load room');
    }
  };

  const populateFromBooking = (b: any) => {
    setGuestName(b.guestName || '');
    setGuestPassport(b.guestPassport || '');
    setGuestOrigin(b.guestOrigin || '');
    setGuestContact(b.guestContact || '');
    setEmergencyName(b.guestEmergencyContactName || '');
    setEmergencyContact(b.guestEmergencyContactNo || '');
    setTotalGuest(b.totalGuest || 1);
    setStayDuration(b.stayDuration || 1);
    if (b.bookingDate) setBookingDate(new Date(b.bookingDate).toISOString().slice(0, 16));
    if (b.guestCheckIn) setCheckInDate(new Date(b.guestCheckIn).toISOString().slice(0, 16));
    if (b.guestCheckOut) setCheckOutDate(new Date(b.guestCheckOut).toISOString().slice(0, 16));
    setRemarks(b.remarks || '');
    setDeposit(Number(b.deposit) || 20);
    setPayment(Number(b.payment) || 0);
    setRefund(Number(b.refund) || 0);
  };

  // BR-3: SubTotal calculation
  const roomPrice = room ? Number(room.roomPrice) : 0;
  const subTotal = stayDuration * roomPrice;
  const totalDue = subTotal + deposit;

  const handleSave = async () => {
    setError(''); setSuccess('');
    if (!guestName.trim()) { setError('Please key in Guest Name'); return; }
    if (!guestPassport.trim()) { setError('Please key in Guest Passport/IC No'); return; }

    try {
      await bookingsApi.create({
        roomId: parseInt(roomId!, 10),
        guestName, guestPassport, guestOrigin, guestContact,
        guestEmergencyContactName: emergencyName,
        guestEmergencyContactNo: emergencyContact,
        totalGuest, stayDuration,
        bookingDate, guestCheckIn: checkInDate, guestCheckOut: checkOutDate,
        remarks, deposit, payment, refund,
      });
      setSuccess('Booking saved!');
      await loadRoom();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save booking');
    }
  };

  const handleCheckIn = async () => {
    if (!existingBooking) return;
    setError(''); setSuccess('');
    try {
      await bookingsApi.checkIn(existingBooking.id);
      setSuccess('Room is Checked In!');
      await loadRoom();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    if (!existingBooking) return;
    setError(''); setSuccess('');
    try {
      const result = await bookingsApi.checkOut(existingBooking.id, {
        checkOutTime: new Date().toISOString(),
        refund,
      });
      if (result.lateCheckout) {
        setSuccess('Room Checked Out! (Late checkout — deposit not refunded)');
      } else {
        setSuccess('Room is Checked Out!');
      }
      await loadRoom();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Check-out failed');
    }
  };

  const handlePayment = async () => {
    if (!existingBooking) return;
    setError(''); setSuccess('');
    try {
      await bookingsApi.processPayment(existingBooking.id, { payment, deposit, refund });
      setSuccess('Payment processed!');
      await loadRoom();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Payment failed');
    }
  };

  const status = room?.roomStatus || 'Open';
  const isHousekeeping = status === 'Housekeeping';
  const isEditable = !isHousekeeping && status !== 'Maintenance';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#303030' }}>
      <AppBar position="static" sx={{ bgcolor: '#505050' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Room Booking — {room?.roomShortName || '...'}
          </Typography>
          <Typography variant="body2" color="secondary">User: {user?.userId}</Typography>
        </Toolbar>
      </AppBar>

      {/* Status Bar */}
      <Box sx={{ bgcolor: STATUS_COLORS[status] || '#505050', p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight="bold" color="#000">
          Booking No: {existingBooking ? String(existingBooking.id).padStart(6, '0') : 'New'}
        </Typography>
        <Typography variant="h6" fontWeight="bold" color="#000">{status}</Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Grid container spacing={2}>
          {/* Booking Details */}
          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: '#404040', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" mb={1}>Booking Details</Typography>
                <Stack spacing={1.5}>
                  <TextField label="Booking Date" type="datetime-local" value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)} fullWidth size="small"
                    disabled={!isEditable} InputLabelProps={{ shrink: true }} />
                  <FormControl fullWidth size="small">
                    <InputLabel>Total Guest</InputLabel>
                    <Select value={totalGuest} label="Total Guest" disabled={!isEditable}
                      onChange={(e) => setTotalGuest(Number(e.target.value))}>
                      {[1,2,3,4,5,6].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth size="small">
                    <InputLabel>Stay Duration (Nights)</InputLabel>
                    <Select value={stayDuration} label="Stay Duration (Nights)" disabled={!isEditable}
                      onChange={(e) => setStayDuration(Number(e.target.value))}>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField label="Check-IN Date & Time" type="datetime-local" value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)} fullWidth size="small"
                    disabled={!isEditable} InputLabelProps={{ shrink: true }} />
                  <TextField label="Check-OUT Date & Time" type="datetime-local" value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)} fullWidth size="small"
                    disabled={!isEditable} InputLabelProps={{ shrink: true }} />
                </Stack>
              </CardContent>
            </Card>

            {/* Guest Details */}
            <Card sx={{ bgcolor: '#404040', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" mb={1}>Guest Details</Typography>
                <Stack spacing={1.5}>
                  <TextField label="Name *" value={guestName} onChange={(e) => setGuestName(e.target.value)}
                    fullWidth size="small" disabled={!isEditable} />
                  <TextField label="Passport / IC No *" value={guestPassport}
                    onChange={(e) => setGuestPassport(e.target.value)} fullWidth size="small" disabled={!isEditable} />
                  <TextField label="Country / Origin" value={guestOrigin}
                    onChange={(e) => setGuestOrigin(e.target.value)} fullWidth size="small" disabled={!isEditable} />
                  <TextField label="Contact No" value={guestContact}
                    onChange={(e) => setGuestContact(e.target.value)} fullWidth size="small" disabled={!isEditable} />
                </Stack>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card sx={{ bgcolor: '#404040' }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" mb={1}>Emergency Contact</Typography>
                <Stack spacing={1.5}>
                  <TextField label="Contact Person" value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)} fullWidth size="small" disabled={!isEditable} />
                  <TextField label="Contact No" value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)} fullWidth size="small" disabled={!isEditable} />
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Room & Payment */}
          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: '#404040', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" mb={1}>Room Details</Typography>
                <Stack spacing={1}>
                  <Typography>Room No: <strong>{room?.roomShortName}</strong></Typography>
                  <Typography>Room Type: <strong>{room?.roomType}</strong></Typography>
                  <Typography>Location: <strong>{room?.roomLocation}</strong></Typography>
                  <Typography>Rate (MYR): <strong>{roomPrice.toFixed(2)}</strong></Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography>Sub Total (MYR): <strong>{subTotal.toFixed(2)}</strong></Typography>
                  <TextField label="Deposit (MYR)" type="number" value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))} fullWidth size="small" disabled={!isEditable} />
                  <Typography>Total Due (MYR): <strong>{totalDue.toFixed(2)}</strong></Typography>
                  <TextField label="Payment (MYR)" type="number" value={payment}
                    onChange={(e) => setPayment(Number(e.target.value))} fullWidth size="small" disabled={isHousekeeping} />
                  <TextField label="Refund (MYR)" type="number" value={refund}
                    onChange={(e) => setRefund(Number(e.target.value))} fullWidth size="small"
                    disabled={status !== 'Occupied'} />
                </Stack>
              </CardContent>
            </Card>

            <Card sx={{ bgcolor: '#404040', mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" color="primary" mb={1}>Remarks</Typography>
                <TextField multiline rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  fullWidth size="small" disabled={!isEditable} />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Stack spacing={1}>
              {status === 'Open' && (
                <Button variant="contained" color="success" onClick={handleSave} fullWidth size="large">
                  💾 Save Booking (Ctrl+S)
                </Button>
              )}
              {existingBooking && status !== 'Open' && (
                <Button variant="contained" onClick={handlePayment} fullWidth>
                  💰 Update Payment
                </Button>
              )}
              {status === 'Booked' && (
                <Button variant="contained" color="info" onClick={handleCheckIn} fullWidth size="large">
                  🏨 Check-IN (Ctrl+I)
                </Button>
              )}
              {status === 'Occupied' && (
                <Button variant="contained" color="warning" onClick={handleCheckOut} fullWidth size="large">
                  🚪 Check-OUT (Ctrl+O)
                </Button>
              )}
              <Button variant="outlined" onClick={() => navigate('/dashboard')} fullWidth>
                Close (Esc)
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}