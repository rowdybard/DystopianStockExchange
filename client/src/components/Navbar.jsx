import { Link, NavLink } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="nav">
      <div className="nav-left">
        <Link to="/" className="brand">🏛️ Dystopian Exchange</Link>
      </div>
      <div className="nav-right">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>Market</NavLink>
        <NavLink to="/events" className={({ isActive }) => isActive ? 'active' : ''}>Events</NavLink>
      </div>
    </nav>
  );
}


