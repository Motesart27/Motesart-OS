const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

if (!API_URL) {
  console.warn('[Motesart] VITE_API_URL is not set — API calls will fail');
}

function getToken() {
  return localStorage.getItem('som_token');
}

export function setToken(token) {
  localStorage.setItem('som_token', token);
}

export function clearToken() {
  localStorage.removeItem('som_token');
  localStorage.removeItem('som_user');
}

function getHeaders(includeJson = true) {
  const token = getToken();
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(path, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...getHeaders(options.body !== undefined),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 401) {
    window.dispatchEvent(new Event('som:force-logout'));
    throw new Error(data?.message || 'Unauthorized');
  }

  if (!res.ok) {
    throw new Error(data?.message || `Request failed: ${res.status}`);
  }

  return data;
}

const api = {
  login(email, password) {
    return request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(name, email, password) {
    return request('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  verifySession() {
    if (!getToken()) throw new Error('No token');
    return request('/api/verify');
  },

  async wake() {
    try {
      const res = await fetch(`${API_URL}/api/health`);
      const text = await res.text();
      try { return JSON.parse(text); }
      catch { return { ok: true, raw: text }; }
    } catch {
      await new Promise(r => setTimeout(r, 1500));
      const res = await fetch(`${API_URL}/api/health`);
      const text = await res.text();
      try { return JSON.parse(text); }
      catch { return { ok: true, raw: text }; }
    }
  },

  post(path, body = {}) {
    return request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export default api;
export { api };
