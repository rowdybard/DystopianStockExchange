import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config.js';

export default function CitizenPage() {
  const { id } = useParams();
  const [citizen, setCitizen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  async function fetchCitizen() {
    try {
      const res = await axios.get(`${API_BASE}/api/citizens/${id}`, { withCredentials: true });
      setCitizen(res.data.citizen);
    } catch (err) {
      setError('Failed to load citizen');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCitizen();
    const idInterval = setInterval(fetchCitizen, 30000);
    return () => clearInterval(idInterval);
  }, [id]);

  const canAffirm = true;
  const canDoubt = true;

  async function vote(type) {
    setActionError('');
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/votes`, { targetCitizenId: id, voteType: type }, { withCredentials: true });
      setCitizen((prev) => prev ? { ...prev, index_value: res.data.newIndex } : prev);
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Vote failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function activateStability(data) {
    setActionError('');
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE}/api/citizens/${id}/stability`, data, { withCredentials: true });
      await fetchCitizen();
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Stability activation failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="card">Loading citizen…</div>;
  if (error) return <div className="card error">{error}</div>;
  if (!citizen) return null;

  const stabilityActive = citizen.stability_status && citizen.stability_expires_at && new Date(citizen.stability_expires_at) > new Date();

  return (
    <div className="stack">
      <div className="card">
        <div className="title">{citizen.alias}</div>
        <div className="big-index">{Number(citizen.index_value).toFixed(2)}</div>
        <div className="row gap">
          <button disabled={!canAffirm || actionLoading} onClick={() => vote('affirm')}>Affirm ↑</button>
          <button disabled={!canDoubt || actionLoading} onClick={() => vote('doubt')}>Doubt ↓</button>
        </div>
        {actionError && <div className="error small">{actionError}</div>}
      </div>

      <div className="card">
        <div className="title">Stability Protocol</div>
        <div className="row gap small">
          <span>Status: {stabilityActive ? 'ACTIVE' : 'INACTIVE'}</span>
          {citizen.stability_expires_at && <span>Expires: {new Date(citizen.stability_expires_at).toLocaleTimeString()}</span>}
        </div>
        <StabilityForm onSubmit={activateStability} disabled={actionLoading} />
      </div>
    </div>
  );
}

function StabilityForm({ onSubmit, disabled }) {
  const [birthMonth, setBirthMonth] = useState('');
  const [favoriteColor, setFavoriteColor] = useState('');
  const [city, setCity] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({ birthMonth, favoriteColor, city });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="row">
        <input placeholder="Birth Month" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required />
        <input placeholder="Favorite Color" value={favoriteColor} onChange={(e) => setFavoriteColor(e.target.value)} required />
        <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required />
      </div>
      <button disabled={disabled} type="submit">Activate Stability</button>
    </form>
  );
}


