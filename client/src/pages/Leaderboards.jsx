import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config.js';

export default function Leaderboards() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchBoards() {
    try {
      const res = await axios.get(`${API_BASE}/api/leaderboard`, { withCredentials: true });
      setData(res.data);
    } catch (e) {
      setError('Failed to load leaderboards');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBoards();
    const id = setInterval(fetchBoards, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="card">Loading leaderboards…</div>;
  if (error) return <div className="card error">{error}</div>;
  if (!data) return null;

  return (
    <div className="grid">
      <Board title="Top Gainers" rows={data.topGainers} valueKey="index_value" />
      <Board title="Top Losers" rows={data.topLosers} valueKey="index_value" />
      <Board title="Most Affirmed" rows={data.mostAffirmed} valueKey="affirm_count" />
      <Board title="Most Doubted" rows={data.mostDoubted} valueKey="doubt_count" />
      <Board title="Most Active Voters" rows={data.mostActiveVoters} valueKey="vote_count" isUser />
      <Board title="Most Sanctioned" rows={data.mostSanctioned} valueKey="sanction_count" />
    </div>
  );
}

function Board({ title, rows, valueKey, isUser }) {
  return (
    <div className="card">
      <div className="title">{title}</div>
      <div className="stack">
        {(rows || []).map((r) => (
          <div key={(r.id || r.alias)} className="row space">
            <div>{r.alias}</div>
            <div className="muted">{Number(r[valueKey] || 0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


