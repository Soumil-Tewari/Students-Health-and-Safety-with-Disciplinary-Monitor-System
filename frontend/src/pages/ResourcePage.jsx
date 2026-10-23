import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import { Box, Button, TextField, MenuItem, Paper, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TableSortLabel,
  TablePagination, LinearProgress, Fab, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Stack } from '@mui/material';
import { api, msg, useCtx, LABEL } from '../api.js';

export function FormDialog({ title, fields, initial, onClose, onSave }) {
  const [v, setV] = useState(initial), [tried, setTried] = useState(false);
  const submit = () => { setTried(true); if (Object.entries(fields).every(([f, s]) => !s.r || (v[f] ?? '') !== '')) onSave(v); };
  return <Dialog open fullWidth maxWidth="sm" onClose={onClose}><DialogTitle>{title}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{Object.entries(fields).map(([f, s]) =>
      <TextField key={f} label={f.replace('_', ' ')} required={!!s.r} select={!!s.e} multiline={!!s.t} minRows={s.t ? 3 : undefined}
        type={s.d ? 'date' : s.em ? 'email' : s.n ? 'number' : s.pw ? 'password' : 'text'} InputLabelProps={s.d ? { shrink: true } : undefined}
        value={v[f] ?? ''} onChange={e => setV({ ...v, [f]: e.target.value })}
        error={tried && !!s.r && (v[f] ?? '') === ''} helperText={tried && s.r && (v[f] ?? '') === '' ? 'Required' : ''}>
        {s.e && [<MenuItem key="" value="">—</MenuItem>, ...s.e.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)]}</TextField>)}</Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={submit}>Save</Button></DialogActions></Dialog>;
}

function Inner({ k }) {
  const { meta, notify } = useCtx(), m = meta.resources[k], nav = useNavigate();
  const [s, setS] = useState({ page: 0, size: 10, q: '', sort: m.pk, order: 'desc', f: {} }), [qt, setQt] = useState('');
  const [d, setD] = useState({ data: [], total: 0 }), [busy, setBusy] = useState(true), [form, setForm] = useState(null), [del, setDel] = useState(null);
  const [sp, setSp] = useSearchParams();
  useEffect(() => { if (sp.get('new') && m.canWrite) { setForm({ v: {} }); setSp({}, { replace: true }); } }, [sp]);
  const load = useCallback(() => {
    setBusy(true);
    api.get('/' + k, { params: { page: s.page + 1, limit: s.size, q: s.q, sort: s.sort, order: s.order, ...s.f } })
      .then(r => setD(r.data)).catch(e => notify(msg(e), 'error')).finally(() => setBusy(false));
  }, [k, s]);
  useEffect(() => { load(); }, [load]);
  const set = p => setS(x => ({ ...x, page: 0, ...p }));
  const cols = [m.pk, ...(m.hasStudent ? ['student_name'] : []), ...Object.keys(m.fields)];
  const enums = m.filters.filter(f => m.fields[f]?.e);
  const save = async v => {
    try { form.id ? await api.put(`/${k}/${form.id}`, v) : await api.post('/' + k, v); setForm(null); notify('Saved'); load(); }
    catch (e) { notify(msg(e), 'error'); }
  };
  const archive = async () => {
    try { await api.delete(`/${k}/${del}`); setDel(null); notify('Archived'); load(); } catch (e) { notify(msg(e), 'error'); }
  };
  return <>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1, mb: 3, pb: 1, flexWrap: 'nowrap', overflowX: 'auto', '& > *': { flexShrink: 0 } }}>
      <Typography variant="h5" noWrap sx={{ flex: 1, minWidth: 'max-content', textTransform: 'capitalize' }}>{k}</Typography>
      <TextField size="small" label="Search" value={qt} onChange={e => setQt(e.target.value)} onKeyDown={e => e.key === 'Enter' && set({ q: qt })} onBlur={() => qt !== s.q && set({ q: qt })} />
      {enums.map(f => <TextField key={f} size="small" select label={f.replace('_', ' ')} sx={{ minWidth: 130 }} value={s.f[f] || ''} onChange={e => set({ f: { ...s.f, [f]: e.target.value } })}>
        <MenuItem value="">All</MenuItem>{m.fields[f].e.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</TextField>)}
      {m.dated && ['from', 'to'].map(f => <TextField key={f} size="small" type="date" label={f} InputLabelProps={{ shrink: true }} value={s.f[f] || ''} onChange={e => set({ f: { ...s.f, [f]: e.target.value } })} />)}
      {m.canWrite && <Button variant="contained" startIcon={<AddIcon />} sx={{ whiteSpace: 'nowrap' }} onClick={() => setForm({ v: {} })}>Add {LABEL[k]}</Button>}
    </Stack>
    <Paper><TableContainer><Table size="small"><TableHead><TableRow>
      {cols.map(c => <TableCell key={c} sx={{ textTransform: 'capitalize' }}>{c === 'student_name' ? 'student' :
        <TableSortLabel active={s.sort === c} direction={s.order} onClick={() => set({ sort: c, order: s.sort === c && s.order === 'asc' ? 'desc' : 'asc' })}>{c.replace('_', ' ')}</TableSortLabel>}</TableCell>)}
      <TableCell /></TableRow></TableHead>
      <TableBody>{d.data.map(r => <TableRow hover key={r[m.pk]}>
        {cols.map(c => <TableCell key={c} sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r[c]}</TableCell>)}
        <TableCell sx={{ whiteSpace: 'nowrap' }}><Button size="small" onClick={() => nav(`/${k}/${r[m.pk]}`)}>View</Button>
          {m.canWrite && <><Button size="small" onClick={() => setForm({ id: r[m.pk], v: Object.fromEntries(Object.keys(m.fields).map(f => [f, r[f]])) })}>Edit</Button>
            <Button size="small" color="error" onClick={() => setDel(r[m.pk])}>Archive</Button></>}</TableCell></TableRow>)}
        {!busy && !d.data.length && <TableRow><TableCell colSpan={cols.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records found</TableCell></TableRow>}</TableBody></Table></TableContainer>
      {busy && <LinearProgress />}
      <TablePagination component="div" count={d.total} page={s.page} rowsPerPage={s.size} rowsPerPageOptions={[10, 25, 50]}
        onPageChange={(_, p) => setS({ ...s, page: p })} onRowsPerPageChange={e => set({ size: +e.target.value })} /></Paper>
    {m.canWrite && <Fab variant="extended" color="primary" sx={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1100 }} onClick={() => setForm({ v: {} })}><AddIcon sx={{ mr: 1 }} />Add {LABEL[k]}</Fab>}
    {form && <FormDialog title={`${form.id ? 'Edit' : 'Add'} ${k}`} fields={m.fields} initial={form.v} onClose={() => setForm(null)} onSave={save} />}
    <Dialog open={del != null} onClose={() => setDel(null)}><DialogTitle>Archive this record?</DialogTitle>
      <DialogContent>It will be hidden from lists but kept in the database.</DialogContent>
      <DialogActions><Button onClick={() => setDel(null)}>Cancel</Button><Button color="error" onClick={archive}>Archive</Button></DialogActions></Dialog>
  </>;
}

export default function ResourcePage() {
  const { resource } = useParams(), { meta } = useCtx();
  if (!meta.resources[resource]) return <Navigate to="/" />;
  return <Inner key={resource} k={resource} />;
}
