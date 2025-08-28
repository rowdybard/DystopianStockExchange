import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config.js';
import LandingModal from '../components/LandingModal.jsx';

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

  const [showLanding, setShowLanding] = useState(false);
  async function checkSession() {
    try {
      await axios.get(`${API_BASE}/api/auth/me`, { withCredentials: true });
    } catch (e) {
      if (e?.response?.status === 401) {
        setShowLanding(true);
      }
    }
  }

  useEffect(() => {
    (async () => {
      await checkSession();
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

  async function loginMarket({ alias, password }) {
    try {
      await axios.post(`${API_BASE}/api/auth/login`, { alias, password }, { withCredentials: true });
      setShowLanding(false);
      await fetchCitizens();
    } catch (e) {
      setError(e?.response?.data?.error || 'Login failed');
    }
  }

  async function registerCustom({ alias, password }) {
    try {
      await axios.post(`${API_BASE}/api/auth/register`, { alias, password }, { withCredentials: true });
      setShowLanding(false);
      await fetchCitizens();
    } catch (e) {
      setError(e?.response?.data?.error || 'Registration failed');
    }
  }

  if (!citizens.length) {
    return (
      <>
        <div className="card">
          <div className="title">Market Board</div>
          <div className="row space">
            <div className="muted">No citizens yet.</div>
            <button onClick={() => setShowLanding(true)}>Join Market</button>
          </div>
        </div>
        <LandingModal
          open={showLanding}
          onJoin={async () => { setJoining(true); await joinMarket(); setShowLanding(false); }}
          onLogin={loginMarket}
          onRegister={registerCustom}
          onClose={() => setShowLanding(false)}
        />
      </>
    );
  }

  return (
    <div className="grid">
      {citizens.map((c) => {
        let changePct = 0;
        if (c.index_value_midnight_utc && Number(c.index_value_midnight_utc) > 0) {
          changePct = ((Number(c.index_value) - Number(c.index_value_midnight_utc)) * 100) / Number(c.index_value_midnight_utc);
        }
        return (
          <Link key={c.id} to={`/citizen/${c.id}`} className="card citizen">
            <div className="alias">{c.alias}</div>
            <div className={`index ${Number(changePct) >= 0 ? 'up' : 'down'}`}>{Number(c.index_value).toFixed(2)}</div>
            <div className="meta">
              <span>{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%</span>
              <span>{c.is_active ? 'ACTIVE' : 'IDLE'}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}


