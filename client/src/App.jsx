import { Routes, Route, Navigate } from 'react-router-dom';
import MarketBoard from './pages/MarketBoard.jsx';
import CitizenPage from './pages/CitizenPage.jsx';
import EventsFeed from './pages/EventsFeed.jsx';
import Navbar from './components/Navbar.jsx';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/" element={<MarketBoard />} />
          <Route path="/citizen/:id" element={<CitizenPage />} />
          <Route path="/events" element={<EventsFeed />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}


