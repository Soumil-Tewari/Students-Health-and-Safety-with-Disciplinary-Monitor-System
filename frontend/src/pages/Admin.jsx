import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import { Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell, Button, Box, TableContainer, Fab } from '@mui/material';
import { api, msg, useCtx } from '../api.js';
import { FormDialog } from './ResourcePage.jsx';

const Grid = ({ cols, rows, extra }) => <Paper><TableContainer sx={{ maxHeight: '70vh' }}><Table size="small" stickyHeader><TableHead><TableRow>
  {cols.map(c => <TableCell key={c}>{c}</TableCell>)}{extra && <TableCell />}</TableRow></TableHead>
  <TableBody>{rows.map((r, i) => <TableRow key={i}>{cols.map(c => <TableCell key={c}>{String(r[c] ?? '')}</TableCell>)}{extra && <TableCell>{extra(r)}</TableCell>}</TableRow>)}</TableBody></Table></TableContainer></Paper>;

export function Users() {
  const { notify } = useCtx(), [rows, setRows] = useState([]), [form, setForm] = useState(false);
  const load = useCallback(() => api.get('/users').then(r => setRows(r.data)).catch(e => notify(msg(e), 'error')), []);
  useEffect(() => { load(); }, [load]);
  const [sp, setSp] = useSearchParams();
  useEffect(() => { if (sp.get('new')) { setForm(true); setSp({}, { replace: true }); } }, [sp]);
  const save = async v => { try { await api.post('/users', v); setForm(false); notify('User created'); load(); } catch (e) { notify(msg(e), 'error'); } };
  const remove = async id => { if (!confirm('Delete this user? The user will no longer be able to sign in.')) return; try { await api.delete('/users/' + id); notify('Deleted'); load(); } catch (e) { notify(msg(e), 'error'); } };
  return <><Box sx={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', mt: 1, mb: 3 }}><Typography variant="h5" noWrap sx={{ flex: 1 }}>User Management</Typography><Button variant="contained" startIcon={<AddIcon />} onClick={() => setForm(true)}>Add user</Button></Box>
    <Grid cols={['name', 'email', 'role', 'active']} rows={rows} extra={r => r.active ? <Button size="small" color="error" onClick={() => remove(r.user_id)}>Delete</Button> : null} />
    <Fab variant="extended" color="primary" sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1100 }} onClick={() => setForm(true)}><AddIcon sx={{ mr: 1 }} />Add user</Fab>
    {form && <FormDialog title="New user" initial={{ role: 'viewer' }} onClose={() => setForm(false)} onSave={save}
      fields={{ name: { r: 1 }, email: { r: 1, em: 1 }, password: { r: 1, pw: 1 }, role: { r: 1, e: ['admin', 'staff', 'medical', 'viewer'] } }} />}</>;
}
export function Audit() {
  const { notify } = useCtx(), [rows, setRows] = useState([]);
  useEffect(() => { api.get('/audit').then(r => setRows(r.data)).catch(e => notify(msg(e), 'error')); }, []);
  return <><Typography variant="h5" sx={{ mb: 2 }}>Audit Log</Typography><Grid cols={['at', 'user_id', 'action', 'entity', 'entity_id', 'detail']} rows={rows} /></>;
}
