import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../utils/api';
import {
  Box, Typography, TextField, Button, Card, CardContent, Stack,
  Table, TableHead, TableRow, TableCell, TableBody, AppBar, Toolbar,
  IconButton, FormControl, InputLabel, Select, MenuItem, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/** Maps to legacy frmReport.frm — Daily, Weekly, Shift reports */
export default function ReportsPage() {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      let data;
      switch (reportType) {
        case 'daily':
          data = await reportsApi.daily(date);
          break;
        case 'weekly':
          data = await reportsApi.weekly(startDate, endDate);
          break;
        case 'shift':
          data = await reportsApi.shift(date);
          break;
        default:
          data = await reportsApi.daily(date);
      }
      setReportData(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#303030' }}>
      <AppBar position="static" sx={{ bgcolor: '#505050' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6">Reports</Typography>
        </Toolbar>
      </AppBar>

      <Box p={2}>
        <Card sx={{ bgcolor: '#404040', mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Report Type</InputLabel>
                <Select value={reportType} label="Report Type" onChange={(e) => setReportType(e.target.value)}>
                  <MenuItem value="daily">Daily Booking Report</MenuItem>
                  <MenuItem value="weekly">Weekly Booking Report</MenuItem>
                  <MenuItem value="shift">Shift Report (My Bookings)</MenuItem>
                </Select>
              </FormControl>

              {(reportType === 'daily' || reportType === 'shift') && (
                <TextField label="Date" type="date" size="small" value={date}
                  onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
              )}
              {reportType === 'weekly' && (
                <>
                  <TextField label="Start Date" type="date" size="small" value={startDate}
                    onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                  <TextField label="End Date" type="date" size="small" value={endDate}
                    onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </>
              )}

              <Button variant="contained" onClick={generateReport} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {reportData && (
          <Card sx={{ bgcolor: '#404040' }}>
            <CardContent>
              <Typography variant="h6" color="primary" mb={1}>{reportData.reportTitle}</Typography>
              {reportData.company && (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {reportData.company.companyName} — {reportData.company.streetAddress}
                </Typography>
              )}
              <Divider sx={{ mb: 2 }} />

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Booking ID</TableCell>
                    <TableCell>Guest</TableCell>
                    <TableCell>Room</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Deposit</TableCell>
                    <TableCell align="right">Payment</TableCell>
                    {reportType === 'shift' && <TableCell align="right">Total</TableCell>}
                    <TableCell>Created By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reportData.bookings?.map((b: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{b.bookingId}</TableCell>
                      <TableCell>{b.guestName}</TableCell>
                      <TableCell>{b.roomNo}</TableCell>
                      <TableCell>{b.roomType}</TableCell>
                      <TableCell align="right">{b.deposit?.toFixed(2)}</TableCell>
                      <TableCell align="right">{b.payment?.toFixed(2)}</TableCell>
                      {reportType === 'shift' && <TableCell align="right">{b.total?.toFixed(2)}</TableCell>}
                      <TableCell>{b.createdBy}</TableCell>
                    </TableRow>
                  ))}
                  {reportData.bookings?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">No bookings found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {reportData.totals && (
                <Box mt={2} p={1} sx={{ bgcolor: '#505050', borderRadius: 1 }}>
                  <Stack direction="row" spacing={4}>
                    <Typography><strong>Total Deposit:</strong> MYR {reportData.totals.deposit?.toFixed(2)}</Typography>
                    <Typography><strong>Total Payment:</strong> MYR {reportData.totals.payment?.toFixed(2)}</Typography>
                    {reportData.totals.total !== undefined && (
                      <Typography><strong>Net Total:</strong> MYR {reportData.totals.total?.toFixed(2)}</Typography>
                    )}
                    {reportData.totals.count !== undefined && (
                      <Typography><strong>Count:</strong> {reportData.totals.count}</Typography>
                    )}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}