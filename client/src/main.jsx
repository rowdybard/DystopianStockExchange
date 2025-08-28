import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

const root = createRoot(document.getElementById('root'));
// Set install_id if missing
try {
  const key = 'install_id';
  if (!document.cookie.includes(`${key}=`)) {
    const id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const expires = new Date(Date.now() + 365*24*60*60*1000).toUTCString();
    document.cookie = `${key}=${id}; expires=${expires}; path=/`;
  }
} catch {}
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);


