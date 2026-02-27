import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../utils/api';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Stack,
} from '@mui/material';

/** Maps to legacy frmUserChangePassword.frm — BR-8, BR-17 */
export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 4) {
      setError('Password must at least 4 characters!'); // BR-17
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await authApi.changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#303030' }}>
      <Card sx={{ maxWidth: 420, width: '100%', bgcolor: '#404040' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom color="primary">Change Password</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            You must change your password before continuing.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>Password changed! Redirecting...</Alert>}
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField label="Current Password" type="password" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} fullWidth required />
              <TextField label="New Password" type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} fullWidth required
                helperText="Minimum 4 characters" />
              <TextField label="Confirm Password" type="password" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} fullWidth required />
              <Button type="submit" variant="contained" size="large" fullWidth>Change Password</Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}