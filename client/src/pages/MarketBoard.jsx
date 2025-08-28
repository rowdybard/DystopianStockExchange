import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config.js';

export default function MarketBoard() {
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  async function fetchCitizens() {
    try {
      const res = await axios.get(`${API_BASE}/api/citizens`, { withCredentials: true });
      setCitizens(res.data.citizens || []);
    } catch (err) {
      setError('Failed to load market board');
    } finally {
      setLoading(false);
    }
  }

  async function ensureSession() {
    try {
      await axios.get(`${API_BASE}/api/auth/me`, { withCredentials: true });
    } catch (e) {
      if (e?.response?.status === 401) {
        await axios.post(`${API_BASE}/api/auth/register`, {}, { withCredentials: true });
      }
    }
  }

  useEffect(() => {
    (async () => {
      await ensureSession();
      await fetchCitizens();
    })();
    const id = setInterval(fetchCitizens, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="card">Loading market…</div>;
  if (error) return <div className="card error">{error}</div>;

  async function joinMarket() {
    try {
      setJoining(true);
      await axios.post(`${API_BASE}/api/auth/register`, {}, { withCredentials: true });
      await fetchCitizens();
    } catch (e) {
      setError('Failed to join market');
    } finally {
      setJoining(false);
    }
  }

  if (!citizens.length) {
    return (
      <div className="card">
        <div className="title">Market Board</div>
        <div className="row space">
          <div className="muted">No citizens yet.</div>
          <button onClick={joinMarket} disabled={joining}>{joining ? 'Joining…' : 'Join Market'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      {citizens.map((c) => (
        <Link key={c.id} to={`/citizen/${c.id}`} className="card citizen">
          <div className="alias">{c.alias}</div>
          <div className={`index ${c.index_value >= 100 ? 'up' : 'down'}`}>{Number(c.index_value).toFixed(2)}</div>
          <div className="meta">
            <span>Rep {c.reputation}</span>
            <span>{c.is_active ? 'ACTIVE' : 'IDLE'}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}


