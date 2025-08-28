import { useEffect, useState } from 'react';
import axios from 'axios';

export default function EventsFeed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchEvents() {
    try {
      const res = await axios.get('/api/events?limit=50', { withCredentials: true });
      setEvents(res.data.events || []);
    } catch (err) {
      setError('Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="card">Loading events…</div>;
  if (error) return <div className="card error">{error}</div>;

  return (
    <div className="stack">
      {events.map((e) => (
        <div key={e.id} className="card">
          <div className="row space">
            <div className="bold">{formatEventType(e.event_type)}</div>
            <div className="muted">{new Date(e.created_at).toLocaleTimeString()}</div>
          </div>
          <div>{e.message}</div>
        </div>
      ))}
    </div>
  );
}

function formatEventType(type) {
  switch (type) {
    case 'vote': return 'Player Action';
    case 'sector_uplift': return 'Sector Uplift';
    case 'sector_crash': return 'Sector Crash';
    case 'observation_halt': return 'Observation Halt';
    case 'sanction_wave': return 'Sanction Wave';
    case 'stability_activated': return 'Stability Activated';
    default: return type;
  }
}


