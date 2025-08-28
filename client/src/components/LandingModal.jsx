import { useState } from 'react';

export default function LandingModal({ open, onJoin, onClose, onLogin, onRegister }) {
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [regAlias, setRegAlias] = useState('');
  const [regPassword, setRegPassword] = useState('');
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="title">🏛️ Dystopian Citizen Exchange</div>
        <div className="stack">
          <p>A satirical market where each player is a Citizen Ticket whose Index drifts, is struck by Tribunal events, and can be nudged by others via Affirm/Doubt.</n></p>
          <ul>
            <li>Auto‑drift every 1–2 minutes</li>
            <li>Tribunal events: Uplift, Crash, Observation Halt, Sanction Wave</li>
            <li>Players: Affirm (+) or Doubt (–) with daily limits</li>
            <li>Protection: buy stability time by spending index</li>
          </ul>
          <div className="stack">
            <div className="row gap">
              <button onClick={onJoin}>Register (Random Alias)</button>
              <button onClick={onClose}>Explore Read‑Only</button>
            </div>
            <div className="title">Register (Custom Alias)</div>
            <div className="row">
              <input placeholder="Custom Alias" value={regAlias} onChange={(e) => setRegAlias(e.target.value)} />
              <input placeholder="Password (optional)" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
            </div>
            <div>
              <button onClick={() => onRegister({ alias: regAlias, password: regPassword })}>Register</button>
            </div>
            <div className="title">Login</div>
            <div className="row">
              <input placeholder="Alias (e.g. Citizen-1234)" value={alias} onChange={(e) => setAlias(e.target.value)} />
              <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <button onClick={() => onLogin({ alias, password })}>Login</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


