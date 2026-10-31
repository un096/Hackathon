import axios from 'axios';

const TOKEN_KEY = 'tb-token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 120000 });

api.interceptors.request.use((cfg) => {
  const t = tokenStore.get();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/')) {
      tokenStore.clear();
      if (!location.pathname.startsWith('/login')) location.assign('/login?expired=1');
    }
    return Promise.reject(err);
  },
);

export const errMsg = (e) => {
  const d = e?.response?.data;
  if (d?.details?.length) return `${d.message}: ${d.details.map((x) => `${x.path ? `${x.path} – ` : ''}${x.message}`).join('; ')}`;
  return d?.message || e?.message || 'Something went wrong';
};

// tiny helpers returning `data`
export const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
export const del = (url) => api.delete(url).then((r) => r.data);
