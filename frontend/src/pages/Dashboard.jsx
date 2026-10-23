import { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Table, TableBody, TableRow, TableCell } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import ReportIcon from '@mui/icons-material/Report';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import GavelIcon from '@mui/icons-material/Gavel';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, msg, useCtx } from '../api.js';

const COLORS = ['#2563eb', '#f59e0b', '#16a34a', '#6b7280'];
const Stat = ({ icon, label, value, color }) => value == null ? null :
  <Grid item xs={6} md={4} lg={2}><Card><CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
    <Box sx={{ color, display: 'flex' }}>{icon}</Box><Box><Typography variant="h5">{value}</Typography>
    <Typography variant="caption" color="text.secondary">{label}</Typography></Box></CardContent></Card></Grid>;
const Mini = ({ title, rows, cols }) => !rows ? null : <Grid item xs={12} md={6}><Card><CardContent>
  <Typography variant="subtitle1" gutterBottom>{title}</Typography>
  <Table size="small"><TableBody>{rows.length ? rows.map((r, i) => <TableRow key={i}>{cols.map(c => <TableCell key={c}>{r[c]}</TableCell>)}</TableRow>)
    : <TableRow><TableCell>No data</TableCell></TableRow>}</TableBody></Table></CardContent></Card></Grid>;

export default function Dashboard() {
  const { notify } = useCtx(), [d, setD] = useState(null);
  useEffect(() => { api.get('/dashboard').then(r => setD(r.data)).catch(e => notify(msg(e), 'error')); }, []);
  if (!d) return <CircularProgress />;
  return <Grid container spacing={2}>
    <Stat icon={<PeopleIcon />} label="Students" value={d.students} color="#2563eb" />
    <Stat icon={<BadgeIcon />} label="Staff" value={d.staff} color="#7c3aed" />
    <Stat icon={<ReportIcon />} label="Safety incidents" value={d.incidents} color="#f59e0b" />
    <Stat icon={<LocalHospitalIcon />} label="Health records" value={d.healthRecords} color="#16a34a" />
    <Stat icon={<GavelIcon />} label="Pending discipline" value={d.pendingDiscipline} color="#dc2626" />
    <Stat icon={<NotificationsActiveIcon />} label="Unresolved alerts" value={d.unresolvedAlerts} color="#0891b2" />
    {d.incidentTrend && <Grid item xs={12} md={7}><Card><CardContent><Typography variant="subtitle1">Incident trend (by month)</Typography>
      <ResponsiveContainer width="100%" height={240}><LineChart data={d.incidentTrend}><CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Line dataKey="n" name="Incidents" stroke="#2563eb" strokeWidth={2} /></LineChart></ResponsiveContainer></CardContent></Card></Grid>}
    {d.disciplineByStatus && <Grid item xs={12} md={5}><Card><CardContent><Typography variant="subtitle1">Disciplinary cases by status</Typography>
      <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={d.disciplineByStatus} dataKey="n" nameKey="status" outerRadius={80} label>
        {d.disciplineByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % 4]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card></Grid>}
    <Mini title="Recent incidents" rows={d.recentIncidents} cols={['date', 'student_name', 'incident_type', 'severity']} />
    <Mini title="Recent alerts" rows={d.recentAlerts} cols={['date_time', 'student_name', 'alert_type', 'status']} />
    <Mini title="Recent activity" rows={d.recentActivity} cols={['at', 'action', 'entity', 'entity_id']} />
  </Grid>;
}
