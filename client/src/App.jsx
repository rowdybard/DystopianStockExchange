import { Routes, Route, Navigate } from 'react-router-dom';
import MarketBoard from './pages/MarketBoard.jsx';
import CitizenPage from './pages/CitizenPage.jsx';
import EventsFeed from './pages/EventsFeed.jsx';
import Leaderboards from './pages/Leaderboards.jsx';
import Welcome from './pages/Welcome.jsx';
import Navbar from './components/Navbar.jsx';
import Ticker from './components/Ticker.jsx';
import { ToastProvider } from './components/Toast.jsx';

export default function App() {
  return (
    <ToastProvider>
      <div className="app">
        <Navbar />
        <Ticker />
        <div className="container">
          <Routes>
            <Route path="/" element={<MarketBoard />} />
            <Route path="/welcome" element={<Welcome />} />
            <Route path="/citizen/:id" element={<CitizenPage />} />
            <Route path="/events" element={<EventsFeed />} />
            <Route path="/leaderboards" element={<Leaderboards />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ToastProvider>
  );
}


