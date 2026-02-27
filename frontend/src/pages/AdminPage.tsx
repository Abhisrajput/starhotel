import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../utils/api';
import {
  Box, Typography, Tabs, Tab, Card, CardContent, TextField, Button, Stack,
  Table, TableHead, TableRow, TableCell, TableBody, AppBar, Toolbar, IconButton,
  Alert, Switch, FormControlLabel, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/** Maps to legacy frmAdmin.frm — Company + User management + Module access */
export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  // Only admin (group 1) can access
  if (user?.userGroup !== 1) {
    return (
      <Box p={4}><Alert severity="error">Access denied. Admin only.</Alert></Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#303030' }}>
      <AppBar position="static" sx={{ bgcolor: '#505050' }}>
        <Toolbar>
          <IconButton color="inherit" onClick={() => navigate('/dashboard')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6">Administration</Typography>
        </Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ bgcolor: '#404040' }}>
        <Tab label="Company Setup" />
        <Tab label="User Management" />
        <Tab label="Module Access" />
      </Tabs>
      <Box p={2}>
        {tab === 0 && <CompanySetup />}
        {tab === 1 && <UserManagement />}
        {tab === 2 && <ModuleAccessPanel />}
      </Box>
    </Box>
  );
}

function CompanySetup() {
  const [company, setCompany] = useState<any>(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    adminApi.getCompany().then(setCompany).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await adminApi.updateCompany(company);
      setSuccess('Company settings saved!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save');
    }
  };

  if (!company) return <Typography>Loading...</Typography>;

  return (
    <Card sx={{ bgcolor: '#404040', maxWidth: 600 }}>
      <CardContent>
        <Typography variant="h6" color="primary" mb={2}>Company Setup</Typography>
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Stack spacing={2}>
          <TextField label="Company Name" value={company.companyName || ''} fullWidth
            onChange={(e) => setCompany({ ...company, companyName: e.target.value })} />
          <TextField label="Address" value={company.streetAddress || ''} fullWidth
            onChange={(e) => setCompany({ ...company, streetAddress: e.target.value })} />
          <TextField label="Contact" value={company.contactNo || ''} fullWidth
            onChange={(e) => setCompany({ ...company, contactNo: e.target.value })} />
          <TextField label="Currency Symbol" value={company.currencySymbol || 'MYR'} fullWidth
            onChange={(e) => setCompany({ ...company, currencySymbol: e.target.value })} />
          <Button variant="contained" onClick={handleSave}>Save</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ userId: '', userName: '', password: '', userGroup: 4, idle: 0 });
  const [error, setError] = useState('');

  const loadUsers = () => adminApi.getUsers().then(setUsers).catch(console.error);
  useEffect(() => { loadUsers(); }, []);

  const handleAdd = async () => {
    setError('');
    try {
      await adminApi.createUser(newUser);
      setShowAdd(false);
      setNewUser({ userId: '', userName: '', password: '', userGroup: 4, idle: 0 });
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleReset = async (userId: string) => {
    try {
      await adminApi.resetUser(userId);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset');
    }
  };

  return (
    <>
      <Stack direction="row" justifyContent="space-between" mb={2}>
        <Typography variant="h6" color="primary">Users</Typography>
        <Button variant="contained" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add User'}
        </Button>
      </Stack>

      {showAdd && (
        <Card sx={{ bgcolor: '#404040', mb: 2, p: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <Stack spacing={1.5}>
            <TextField label="User ID" value={newUser.userId} size="small"
              onChange={(e) => setNewUser({ ...newUser, userId: e.target.value })} />
            <TextField label="User Name" value={newUser.userName} size="small"
              onChange={(e) => setNewUser({ ...newUser, userName: e.target.value })} />
            <TextField label="Password" type="password" value={newUser.password} size="small"
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              helperText="Minimum 4 characters" />
            <FormControl size="small">
              <InputLabel>User Group</InputLabel>
              <Select value={newUser.userGroup} label="User Group"
                onChange={(e) => setNewUser({ ...newUser, userGroup: Number(e.target.value) })}>
                <MenuItem value={1}>Administrator</MenuItem>
                <MenuItem value={2}>Manager</MenuItem>
                <MenuItem value={3}>Supervisor</MenuItem>
                <MenuItem value={4}>Clerk</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleAdd}>Create User</Button>
          </Stack>
        </Card>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>User ID</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Group</TableCell>
            <TableCell>Active</TableCell>
            <TableCell>Login Attempts</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.userId}>
              <TableCell>{u.userId}</TableCell>
              <TableCell>{u.userName}</TableCell>
              <TableCell>{u.userGroup}</TableCell>
              <TableCell>{u.active ? '✅' : '❌'}</TableCell>
              <TableCell>{u.loginAttempts}</TableCell>
              <TableCell>
                {(!u.active || u.loginAttempts > 0) && (
                  <Button size="small" onClick={() => handleReset(u.userId)}>Reset</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

function ModuleAccessPanel() {
  const [modules, setModules] = useState<any[]>([]);

  const loadModules = () => adminApi.getModuleAccess().then(setModules).catch(console.error);
  useEffect(() => { loadModules(); }, []);

  const handleToggle = async (mod: any, group: string) => {
    const data = { group1: mod.group1, group2: mod.group2, group3: mod.group3, group4: mod.group4 };
    (data as any)[group] = !(mod as any)[group];
    try {
      await adminApi.updateCompany; // placeholder
      // Actually update module access
      const response = await fetch(`/api/admin/module-access/${mod.moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: JSON.stringify(data),
      });
      if (response.ok) loadModules();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Typography variant="h6" color="primary" mb={2}>Module Access Control</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Module</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Group 1 (Admin)</TableCell>
            <TableCell>Group 2 (Manager)</TableCell>
            <TableCell>Group 3 (Supervisor)</TableCell>
            <TableCell>Group 4 (Clerk)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {modules.map((m) => (
            <TableRow key={m.moduleId}>
              <TableCell>{m.moduleDesc}</TableCell>
              <TableCell>{m.moduleType}</TableCell>
              <TableCell>
                <Switch checked={m.group1} onChange={() => handleToggle(m, 'group1')} size="small" />
              </TableCell>
              <TableCell>
                <Switch checked={m.group2} onChange={() => handleToggle(m, 'group2')} size="small" />
              </TableCell>
              <TableCell>
                <Switch checked={m.group3} onChange={() => handleToggle(m, 'group3')} size="small" />
              </TableCell>
              <TableCell>
                <Switch checked={m.group4} onChange={() => handleToggle(m, 'group4')} size="small" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}