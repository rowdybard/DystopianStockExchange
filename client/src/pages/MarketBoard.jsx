import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../config.js';

export default function MarketBoard() {
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchCitizens();
    const id = setInterval(fetchCitizens, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="card">Loading market…</div>;
  if (error) return <div className="card error">{error}</div>;

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


