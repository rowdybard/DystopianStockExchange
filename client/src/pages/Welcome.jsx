import { useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config.js';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [regAlias, setRegAlias] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function registerRandom() {
    try {
      setError(''); setLoading(true);
      await axios.post(`${API_BASE}/api/auth/register`, {}, { withCredentials: true });
      navigate('/');
    } catch (e) {
      setError(e?.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  }

  async function registerCustom() {
    try {
      setError(''); setLoading(true);
      await axios.post(`${API_BASE}/api/auth/register`, { alias: regAlias, password: regPassword }, { withCredentials: true });
      navigate('/');
    } catch (e) {
      setError(e?.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  }

  async function login() {
    try {
      setError(''); setLoading(true);
      await axios.post(`${API_BASE}/api/auth/login`, { alias, password }, { withCredentials: true });
      navigate('/');
    } catch (e) {
      setError(e?.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="title">🏛️ Dystopian Citizen Exchange</div>
        <p>A satirical market where each player is a Citizen Ticket. Your Index drifts, is struck by Tribunal events, and can be nudged by others via Affirm/Doubt.</p>
        <ul>
          <li>Auto‑drift every 1–2 minutes</li>
          <li>Tribunal: Uplift, Crash, Observation Halt, Sanction Wave</li>
          <li>Daily limits for Affirm/Doubt</li>
          <li>Buy protection by spending index</li>
        </ul>
        {error && <div className="card error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      <div className="card">
        <div className="title">Register</div>
        <div className="row gap" style={{ marginBottom: 8 }}>
          <button disabled={loading} onClick={registerRandom}>Register (Random Alias)</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Custom Alias" value={regAlias} onChange={(e) => setRegAlias(e.target.value)} />
          <input placeholder="Password (optional)" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
          <button disabled={loading} onClick={registerCustom}>Register</button>
        </div>
      </div>

      <div className="card">
        <div className="title">Login</div>
        <div className="row" style={{ gap: 8 }}>
          <input placeholder="Alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={loading} onClick={login}>Login</button>
        </div>
      </div>

      <div className="card">
        <div className="row space">
          <div className="muted">Just browsing?</div>
          <button onClick={() => navigate('/')}>Explore Read‑Only</button>
        </div>
      </div>
    </div>
  );
}


