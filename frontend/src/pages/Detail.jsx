import { useEffect, useState } from 'react';
import { useParams, Link as RLink } from 'react-router-dom';
import { Card, CardContent, Typography, Grid, Table, TableHead, TableBody, TableRow, TableCell, Button, CircularProgress, Box } from '@mui/material';
import { api, msg, useCtx } from '../api.js';
import { FormDialog } from './ResourcePage.jsx';

export default function Detail() {
  const { resource: k, id } = useParams(), { meta, notify } = useCtx(), [r, setR] = useState(null), [link, setLink] = useState(false);
  const load = () => api.get(`/${k}/${id}`).then(x => setR(x.data)).catch(e => notify(msg(e), 'error'));
  useEffect(() => { setR(null); load(); }, [k, id]);
  if (!r) return <CircularProgress />;
  const entries = Object.entries(r), arrays = entries.filter(([, v]) => Array.isArray(v));
  const route = { parents: 'parents', students: 'students', incidents: 'incidents', incidents_reported: 'incidents', discipline: 'discipline', alerts: 'alerts', alerts_generated: 'alerts', health: 'health' };
  const unlink = async pid => { try { await api.delete(`/links/${r.student_id}/${pid}`); notify('Unlinked'); load(); } catch (e) { notify(msg(e), 'error'); } };
  const doLink = async v => { try { await api.post('/links', { student_id: r.student_id, parent_id: +v.parent_id, relation: v.relation }); setLink(false); notify('Linked'); load(); } catch (e) { notify(msg(e), 'error'); } };
  return <Box>
    <Button component={RLink} to={`/${k}`}>← Back</Button>
    <Card sx={{ my: 2 }}><CardContent><Grid container spacing={2}>{entries.filter(([, v]) => !Array.isArray(v)).map(([f, v]) =>
      <Grid item xs={6} md={3} key={f}><Typography variant="caption" color="text.secondary">{f.replace('_', ' ')}</Typography><Typography>{String(v ?? '—')}</Typography></Grid>)}</Grid></CardContent></Card>
    {arrays.map(([name, rows]) => <Card key={name} sx={{ mb: 2 }}><CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="h6" sx={{ textTransform: 'capitalize' }}>{name.replace('_', ' ')}</Typography>
        {k === 'students' && name === 'parents' && meta.resources.students.canWrite && <Button onClick={() => setLink(true)}>Link parent</Button>}</Box>
      {rows.length ? <Box sx={{ overflowX: 'auto' }}><Table size="small"><TableHead><TableRow>{Object.keys(rows[0]).map(c => <TableCell key={c}>{c.replace('_', ' ')}</TableCell>)}<TableCell /></TableRow></TableHead>
        <TableBody>{rows.map((x, i) => <TableRow key={i}>{Object.values(x).map((v, j) => <TableCell key={j}>{v}</TableCell>)}
          <TableCell>{k === 'students' && name === 'parents' && meta.resources.students.canWrite && <Button size="small" color="error" onClick={() => unlink(x.parent_id)}>Unlink</Button>}
            {k === 'parents' && <Button size="small" component={RLink} to={`/students/${x.student_id}`}>Open</Button>}</TableCell></TableRow>)}</TableBody></Table></Box>
        : <Typography color="text.secondary">None</Typography>}</CardContent></Card>)}
    {link && <FormDialog title="Link parent" initial={{ relation: 'Mother' }} onClose={() => setLink(false)} onSave={doLink}
      fields={{ parent_id: { r: 1, n: 1 }, relation: { r: 1, e: ['Mother', 'Father', 'Guardian'] } }} />}
  </Box>;
}
