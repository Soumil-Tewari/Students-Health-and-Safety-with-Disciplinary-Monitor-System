import axios from 'axios';
import { createContext, useContext } from 'react';
export const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => { const t = sessionStorage.t; if (t) c.headers.Authorization = 'Bearer ' + t; return c; });
api.interceptors.response.use(r => r, e => {
  if (e.response?.status === 401 && sessionStorage.t) { sessionStorage.removeItem('t'); location.href = '/login'; }
  return Promise.reject(e);
});
export const LABEL = { students: 'student', parents: 'parent', staff: 'staff member', health: 'health record', incidents: 'incident', discipline: 'discipline case', alerts: 'alert' };
export const msg = e => e.response?.data?.error || e.message;
export const Ctx = createContext();
export const useCtx = () => useContext(Ctx);
