# 🏛️ Dystopian Citizen Exchange

A satirical, dystopian stock exchange where each player is a Citizen Ticket. Their Index drifts over time, is hit by Tribunal events, and can be nudged by other players via Affirm/Doubt actions.

## 🎯 Vision

The goal of this MVP is to prove the community fun factor — seeing your and a friend's indexes move live under the Tribunal's rules.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- PostgreSQL (v12+)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up database:**
   ```bash
   # Create PostgreSQL database
   createdb dystopian_exchange
   
   # Copy environment file
   cp .env.example .env
   
   # Set up database schema
   npm run db:setup
   ```

3. **Start development servers:**
   ```bash
   npm run dev
   ```

This will start:
- Backend API on `http://localhost:3001`
- Frontend on `http://localhost:5173`

## 🎮 Core Mechanics

### Citizen Ticket
- Each account = 1 Citizen
- Auto-assigned dystopian corporate-style alias
- Starts at Index ~100

### Index Drift
- Background volatility applies small ±% changes every 1–2 minutes
- Tribunal events apply global shocks every ~10 minutes

### Player Actions
- **Affirm** → nudges target up (+0.5–1%)
- **Doubt** → nudges target down (–0.5–1%)
- Limits: 20 votes/day per user, max 2 per target/day

### Stability Protocol
- Submit trivial info (birth month, favorite color, city)
- Grants 10 minutes of dampened negative volatility
- Cooldown: 1 per hour

## 🏗️ Architecture

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: Cookie-based sessions
- **Real-time**: Polling every 30s

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Citizens
- `GET /api/citizens` - Get all citizens (market board)
- `GET /api/citizens/:id` - Get specific citizen
- `PATCH /api/citizens/:id/index` - Update citizen index
- `POST /api/citizens/:id/stability` - Activate stability protocol

### Voting
- `POST /api/votes` - Submit affirm/doubt vote
- `GET /api/votes/history` - Get voting history

### Events
- `GET /api/events` - Get recent events
- `GET /api/events/citizen/:id` - Get citizen events
- `POST /api/events/tribunal` - Trigger Tribunal event

### Leaderboards
- `GET /api/leaderboard` - Get all leaderboards
- `GET /api/leaderboard/:type` - Get specific leaderboard

## 🎨 Theming

The game features a dystopian corporate aesthetic with:
- Corporate-style citizen aliases (Citizen-0001, Subject-2345, etc.)
- Tribunal events with dramatic messaging
- Compliance-focused stability protocol
- Market-style leaderboards

## 🔧 Development

### Project Structure
```
├── client/          # React frontend
├── server/          # Node.js backend
│   ├── db/         # Database connection
│   ├── routes/     # API routes
│   └── scripts/    # Database scripts
├── package.json     # Root package.json
└── README.md
```

### Available Scripts
- `npm run dev` - Start both frontend and backend
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run db:setup` - Set up database schema
- `npm run build` - Build frontend for production

## 🎯 Success Criteria

- ✅ At least 2 users can join, get Citizens, and affirm/doubt each other
- ✅ Indexes visibly drift on their own + react to global events
- ✅ Stability Protocol visibly reduces volatility
- ✅ Leaderboards update with correct standings
- ✅ Session lasts long enough (~5 minutes) to "feel alive"

## 🚧 MVP Scope

### Included
- Citizen drift, affirm/doubt, tribunal events
- Stability protocol, leaderboards
- Basic multiplayer functionality

### Excluded (Post-MVP)
- Custom names, cosmetics, monetization
- Social feeds, image generation
- Advanced viral growth features

---

*Welcome to the Dystopian Citizen Exchange. Your compliance is appreciated.*