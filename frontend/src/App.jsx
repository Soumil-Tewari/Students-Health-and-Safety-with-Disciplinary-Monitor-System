import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, IconButton, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Badge, Button,
  Snackbar, Alert, Menu, MenuItem, Card, CardContent, TextField, CircularProgress, useMediaQuery } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import BadgeIcon from '@mui/icons-material/Badge';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import GavelIcon from '@mui/icons-material/Gavel';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import HistoryIcon from '@mui/icons-material/History';
import SchoolIcon from '@mui/icons-material/School';
import { api, msg, Ctx, LABEL } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import ResourcePage from './pages/ResourcePage.jsx';
import Detail from './pages/Detail.jsx';
import { Users, Audit } from './pages/Admin.jsx';

const W = 220;
const tabIcons = {
  '/': <DashboardIcon />,
  '/students': <PeopleIcon />,
  '/parents': <FamilyRestroomIcon />,
  '/staff': <BadgeIcon />,
  '/health': <LocalHospitalIcon />,
  '/incidents': <ReportProblemIcon />,
  '/discipline': <GavelIcon />,
  '/alerts': <NotificationsActiveIcon />,
  '/users': <ManageAccountsIcon />,
  '/audit': <HistoryIcon />
};
function Login({ onDone, notify }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const go = async e => {
    e.preventDefault();
    try { const r = await api.post('/auth/login', { email, password }); sessionStorage.t = r.data.token; onDone(); }
    catch (err) { notify(msg(err), 'error'); }
  };
  return <Box sx={{ maxWidth: 360, mx: 'auto', mt: '14vh', px: 2 }}><Card><CardContent component="form" onSubmit={go}>
    <Typography variant="h5" gutterBottom>🏫 Sign in</Typography>
    <TextField fullWidth margin="normal" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
    <TextField fullWidth margin="normal" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
    <Button fullWidth type="submit" variant="contained" sx={{ mt: 1 }}>Login</Button></CardContent></Card></Box>;
}

export default function App() {
  const [meta, setMeta] = useState(null), [ready, setReady] = useState(false), [toast, setToast] = useState(null);
  const [open, setOpen] = useState(true), [unread, setUnread] = useState(0), [anchor, setAnchor] = useState(null);
  const mobile = useMediaQuery('(max-width:800px)'), nav = useNavigate(), loc = useLocation();
  const notify = (m, s = 'success') => setToast({ m, s });
  const load = async () => {
    if (sessionStorage.t) try { setMeta((await api.get('/meta')).data); } catch (e) { sessionStorage.removeItem('t'); notify('Could not load your session: ' + msg(e), 'error'); }
    setReady(true);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (meta?.resources.alerts) api.get('/alerts', { params: { unresolved: 1, limit: 1 } }).then(r => setUnread(r.data.total)).catch(() => {});
  }, [meta, loc.pathname]);
  const logout = async () => { try { await api.post('/auth/logout'); } catch {} sessionStorage.removeItem('t'); setMeta(null); nav('/login'); };

  const snack = <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)}>
    {toast ? <Alert severity={toast.s} variant="filled" onClose={() => setToast(null)}>{toast.m}</Alert> : undefined}</Snackbar>;
  if (!ready) return <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>;
  if (!meta) return <>{<Login notify={notify} onDone={async () => { await load(); nav('/'); }} />}{snack}</>;

  const items = [['/', 'Dashboard'], ...Object.keys(meta.resources).map(k => ['/' + k, k[0].toUpperCase() + k.slice(1)])];
  if (meta.role === 'admin') items.push(['/users', 'User Management'], ['/audit', 'Audit Log']);
  const shift = open && !mobile;
  const quick = [...Object.entries(meta.resources).filter(([, r]) => r.canWrite).map(([k]) => ['/' + k, 'Add ' + LABEL[k]]), ...(meta.role === 'admin' ? [['/users', 'Add user']] : [])];
  return <Ctx.Provider value={{ meta, notify }}>
    <AppBar position="fixed" sx={{ zIndex: t => t.zIndex.drawer + 1 }}><Toolbar>
      <IconButton color="inherit" onClick={() => setOpen(!open)}><MenuIcon /></IconButton>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, ml: 1 }}>
        <SchoolIcon sx={{ fontSize: 28 }} />
        <Typography variant="h6" noWrap sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>Students Health and Safety with Disciplinary Monitor System</Typography>
      </Box>
      {quick.length > 0 && <Button color="inherit" variant="outlined" startIcon={<AddIcon />} sx={{ mr: 1, whiteSpace: 'nowrap', flexShrink: 0, borderColor: 'rgba(255,255,255,.6)' }} onClick={e => setAnchor(e.currentTarget)}>New</Button>}
      <IconButton color="inherit" onClick={() => nav('/alerts')}><Badge badgeContent={unread} color="error"><NotificationsIcon /></Badge></IconButton>
      <Typography sx={{ mx: 1, display: { xs: 'none', sm: 'block' } }}>{meta.role}</Typography>
      <Button color="inherit" onClick={logout}>Logout</Button></Toolbar></AppBar>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>{quick.map(([to, l]) =>
      <MenuItem key={to} onClick={() => { setAnchor(null); nav(to + '?new=1'); }}>{l}</MenuItem>)}</Menu>
    <Drawer variant={mobile ? 'temporary' : 'persistent'} open={open} onClose={() => setOpen(false)}
      sx={{ width: shift ? W : 0, '& .MuiDrawer-paper': { width: W } }}>
      <Toolbar /><List>{items.map(([to, l]) => <ListItemButton key={to} component={NavLink} to={to} end={to === '/'}
        onClick={() => mobile && setOpen(false)} sx={{
          '&.active': { bgcolor: 'primary.main', color: '#fff' },
          '&.active .tab-logo': { bgcolor: 'rgba(255,255,255,.2)' },
          mx: 1, borderRadius: 2
        }}>
        <ListItemIcon className="tab-logo" sx={{
          minWidth: 34, width: 34, height: 34, mr: 1, borderRadius: 1.5,
          color: 'inherit', bgcolor: 'action.hover', justifyContent: 'center'
        }}>{tabIcons[to] || <SchoolIcon />}</ListItemIcon>
        <ListItemText primary={l} />{to === '/alerts' && unread > 0 && <Badge badgeContent={unread} color="error" sx={{ mr: 1 }} />}</ListItemButton>)}</List></Drawer>
    <Box component="main" sx={{ ml: shift ? `${W}px` : 0, p: { xs: 1.5, md: 3 }, pt: 5, pb: 12, transition: 'margin .2s' }}>
      <Toolbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/users" element={<Users />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/:resource" element={<ResourcePage />} />
        <Route path="/:resource/:id" element={<Detail />} />
        <Route path="*" element={<Navigate to="/" />} /></Routes></Box>
    {snack}</Ctx.Provider>;
}
