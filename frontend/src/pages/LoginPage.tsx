import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Stack,
} from '@mui/material';

/** Maps to legacy frmUserLogin.frm */
export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId.trim()) { setError('Please enter your User ID!'); return; }
    if (!password.trim()) { setError('Please enter your Password!'); return; }

    setLoading(true);
    try {
      const result = await login(userId, password);
      if (result.changePassword) {
        navigate('/change-password'); // BR-8
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#303030' }}>
      <Typography variant="h3" color="secondary" fontWeight="bold" mb={1}>
        ⭐ Star Hotel
      </Typography>
      <Typography variant="h6" color="text.secondary" mb={4}>
        Hotel Booking System
      </Typography>

      <Card sx={{ maxWidth: 420, width: '100%', bgcolor: '#404040' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary">User Login</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="User ID" value={userId} autoFocus fullWidth
                onChange={(e) => setUserId(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 10 }}
              />
              <TextField
                label="Password" type="password" value={password} fullWidth
                onChange={(e) => setPassword(e.target.value)}
                inputProps={{ maxLength: 10 }}
              />
              <Button type="submit" variant="contained" size="large" disabled={loading} fullWidth>
                {loading ? 'Logging in...' : 'OK (Enter)'}
              </Button>
              <Typography variant="caption" color="text.secondary" align="center">
                Demo: User ID: ADMIN, Password: admin
              </Typography>
            </Stack>
          </form>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" mt={4}>
        © Computerise System Solutions 2014-2024. All rights reserved.
      </Typography>
    </Box>
  );
}