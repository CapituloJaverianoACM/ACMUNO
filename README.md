# 🂠 ACM UNO

> Real-time multiplayer UNO card game crafted for the **Capítulo Javeriano ACM**. Built with Next.js, Bun, Elysia, and WebSockets.

---

## ✨ Features

- **⚡ Real-Time Multiplayer**: Instant synchronization for 2–10 players per room powered by Bun and Elysia WebSockets.
- **🃏 Complete Deck & Gameplay**: Numbers (0–9), Skip, Reverse, Draw Two (+2), Wild, and Wild Draw Four (+4).
- **🚨 Official UNO Rules & Penalties**:
  - Interactive **¡UNO!** button to protect yourself when down to 1 card.
  - Challenge/denounce opponents who forgot to call UNO, forcing them to draw 2 cards.
- **⏱️ Configurable Turn Timer**: Limits of 15s, 30s, 45s, 60s, or unlimited, with automatic draw on timeout.
- **🪑 Oval Table Layout**: Natural casino/poker-style seating distributing players across top, left, and right flanks with active turn halos and live stats.
- **💫 Vector Physics & Animations**: Flying card trajectories (`getBoundingClientRect`), physical card slam, 3D stacked discard pile, and reverse spin.
- **🌌 Ambient Particle System**: 60 FPS HTML5 Canvas particle background with cyber pixels and UNO motes.
- **🔊 Low-Latency Sound Effects**: Interactive card movement audio with concurrency pool and instant mute/unmute toggle.
- **📱 Quick Room Sharing**: Share rooms via 6-digit PIN or direct QR Code scan with camera support.

---

## 🛠️ Tech Stack

| Area | Technology |
| :--- | :--- |
| **Frontend** | [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), TypeScript |
| **Backend** | [Bun](https://bun.sh/), [Elysia.js](https://elysiajs.com/), Native WebSockets |
| **Graphics & Audio** | HTML5 Canvas 2D, Web Audio API |
| **Testing** | Bun Test runner |

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.1+ recommended)
- [Node.js](https://nodejs.org/) (v18+) & `npm`

### 1. Clone & Install

```bash
git clone https://github.com/CapituloJaverianoACM/ACMUNO.git
cd ACMUNO

# Install Backend dependencies
cd backend && bun install

# Install Frontend dependencies
cd ../frontend && npm install
```

### 2. Run Development Servers

**Backend** (port `3001`):
```bash
cd backend
bun run dev
```

**Frontend** (port `3000`):
```bash
cd frontend
npm run dev
```

Or from the monorepo root:
```bash
npm run dev:backend   # In terminal 1
npm run dev:frontend  # In terminal 2
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

Run backend unit and integration test suite:

```bash
cd backend
bun test
```

Build verification for production frontend:

```bash
cd frontend
npm run build
```

---

## 📂 Project Structure

```text
ACMUNO/
├── assets/                  # Original game graphics & audio assets
├── backend/
│   ├── src/
│   │   ├── domain/          # Game engine, deck generator, turn & UNO rules
│   │   ├── services/        # Room manager & WebSocket broadcast engine
│   │   └── index.ts         # Elysia HTTP + WS server entrypoint
│   └── test/                # Bun test integration & rule suites
├── frontend/
│   ├── public/
│   │   ├── img/             # Rendered UNO card faces, backs & background
│   │   └── sound/           # Card movement sound effects
│   ├── src/
│   │   ├── app/             # Next.js App Router (Lobby & Room pages)
│   │   ├── components/      # GameBoard, UnoCard, ParticleBackground, etc.
│   │   └── lib/             # API client, WebSocket hooks & sound manager
│   └── package.json
└── README.md
```

---
