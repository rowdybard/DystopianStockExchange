import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../config.js';

export default function Ticker() {
  const [events, setEvents] = useState([]);
  const [idx, setIdx] = useState(0);

  async function fetchEvents() {
    try {
      const res = await axios.get(`${API_BASE}/api/events?limit=20`, { withCredentials: true });
      setEvents(res.data.events || []);
    } catch {}
  }

  useEffect(() => {
    fetchEvents();
    const poll = setInterval(fetchEvents, 30000);
    const rotate = setInterval(() => setIdx((i) => i + 1), 4000);
    return () => { clearInterval(poll); clearInterval(rotate); };
  }, []);

  if (!events.length) return null;
  const e = events[idx % events.length];

  return (
    <div className="ticker">
      <span className="muted">Tribunal:</span>
      <span className="msg">{e.message}</span>
    </div>
  );
}


