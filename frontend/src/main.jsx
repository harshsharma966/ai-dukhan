import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercept all /api/ requests to attach the active shop's JWT Bearer token
const originalFetch = window.fetch;
window.fetch = async (resource, init = {}) => {
  const token = localStorage.getItem('kirana_token');
  if (token && typeof resource === 'string' && resource.startsWith('/api')) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    init.headers = headers;
  }
  return originalFetch(resource, init);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
