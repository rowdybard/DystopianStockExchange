import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config.js';
import { useToast } from '../components/Toast.jsx';

export default function CitizenPage() {
  const { id } = useParams();
  const [citizen, setCitizen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const toast = useToast();
  const [quota, setQuota] = useState(null);

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
    fetchQuota();
    const qInterval = setInterval(fetchQuota, 30000);
    return () => { clearInterval(idInterval); clearInterval(qInterval); };
  }, [id]);

  const canAffirm = true;
  const canDoubt = true;

  async function fetchQuota() {
    try {
      const res = await axios.get(`${API_BASE}/api/votes/quota/${id}`, { withCredentials: true });
      setQuota(res.data);
    } catch {}
  }

  async function vote(type) {
    setActionError('');
    setActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/votes`, { targetCitizenId: id, voteType: type }, { withCredentials: true });
      setCitizen((prev) => prev ? { ...prev, index_value: res.data.newIndex } : prev);
      toast.push(`${type === 'affirm' ? 'Affirmed' : 'Doubted'} (${res.data.deltaPercent > 0 ? '+' : ''}${res.data.deltaPercent.toFixed(1)}%)`, 'success');
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Vote failed');
      toast.push(err?.response?.data?.error || 'Vote failed', 'error');
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
      toast.push('Stability protocol activated', 'success');
    } catch (err) {
      setActionError(err?.response?.data?.error || 'Stability activation failed');
      toast.push(err?.response?.data?.error || 'Stability activation failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="card">Loading citizen…</div>;
  if (error) return <div className="card error">{error}</div>;
  if (!citizen) return null;

  const stabilityActive = citizen.stability_status && citizen.stability_expires_at && new Date(citizen.stability_expires_at) > new Date();
  const cooldownMs = citizen.stability_last_activated_at ? Math.max(0, 60 * 60 * 1000 - (Date.now() - new Date(citizen.stability_last_activated_at).getTime())) : 0;
  const cooldownMin = Math.ceil(cooldownMs / 60000);

  return (
    <div className="stack">
      <div className="card">
        <div className="title">{citizen.alias}</div>
        <div className="big-index">{Number(citizen.index_value).toFixed(2)}</div>
        <div className="row gap">
          <button disabled={!canAffirm || actionLoading || (quota && quota.perTypeRemaining?.affirm <= 0)} onClick={() => vote('affirm')}>Affirm ↑</button>
          <button disabled={!canDoubt || actionLoading || (quota && quota.perTypeRemaining?.doubt <= 0)} onClick={() => vote('doubt')}>Doubt ↓</button>
        </div>
        {quota && <div className="row small gap"><span>Daily: {quota.dailyRemaining}</span><span>Affirm left: {quota.perTypeRemaining?.affirm}</span><span>Doubt left: {quota.perTypeRemaining?.doubt}</span></div>}
        {actionError && <div className="error small">{actionError}</div>}
      </div>

      <div className="card">
        <div className="title">Stability Protocol</div>
        <div className="row gap small">
          <span>Status: {stabilityActive ? 'ACTIVE' : 'INACTIVE'}</span>
          {citizen.stability_expires_at && <span>Expires: {new Date(citizen.stability_expires_at).toLocaleTimeString()}</span>}
        </div>
        <div className="row gap small">
          {cooldownMs > 0 ? <span>Cooldown: {cooldownMin}m</span> : <span>Ready</span>}
          {citizen.stability_expires_at && stabilityActive && <span>Ends in: {Math.max(0, Math.ceil((new Date(citizen.stability_expires_at).getTime() - Date.now())/60000))}m</span>}
        </div>
        <StabilityForm onSubmit={activateStability} disabled={actionLoading || cooldownMs > 0} />
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


