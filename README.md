# VeloCall ( Under Development features may get changed and this file may be updated in future )

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)]()
[![Built with Expo](https://img.shields.io/badge/Expo-React%20Native-blue.svg)]()

> **VeloCall** — a production-minded, mobile-first video calling solution built with Expo (React Native + TypeScript) and WebRTC. Fast peer-to-peer media with a lightweight Socket.IO signalling server and optional S3-backed recording support.

---

## Table of Contents

* [Demo / Preview](#demo--preview)
* [Key Features](#key-features)
* [Tech Stack](#tech-stack)
* [Architecture Overview](#architecture-overview)
* [Getting Started](#getting-started)

  * [Prerequisites](#prerequisites)
  * [Local Setup (Backend)](#local-setup-backend)
  * [Local Setup (Mobile Client)](#local-setup-mobile-client)
* [Configuration](#configuration)

  * [Environment variables (`.env.example`)](#environment-variables-envexample)
* [STUN / TURN & Deployment Notes](#stun--turn--deployment-notes)
* [Usage](#usage)
* [Troubleshooting](#troubleshooting)
* [Testing](#testing)
* [Contributing](#contributing)
* [License](#license)
* [Contact / Acknowledgements](#contact--acknowledgements)

---

## Demo / Preview

* Room creation
* Call signaling & connect flow
* Two-way video/audio
* Mute / camera switch / hang up

**Recommended assets:** vertical mobile screenshots (9:16) and a short GIF showing call connect/disconnect flows.

---

## Key Features

* One-to-one real-time video & audio calls (mobile-first)
* WebRTC peer-to-peer media with STUN/TURN fallback
* Lightweight Socket.IO signalling server (SDP / ICE exchange)
* Reconnection and ICE-restart logic for flaky networks
* Optional recording/persistence to S3-compatible storage
* TypeScript across frontend & backend for maintainability and DX

---

## Tech Stack

* **Frontend:** Expo (React Native) + TypeScript
* **Realtime:** WebRTC (native mobile bindings) + Socket.IO for signalling
* **Backend:** Node.js + Express + Socket.IO
* **Storage (optional):** AWS S3 (or S3-compatible)
* **Infrastructure:** STUN/TURN servers (e.g., public STUN, coturn for TURN)

---

## Architecture Overview

1. Client requests a call token / joins a room and connects to the Socket.IO signalling server.
2. Signalling server brokers SDP and ICE messages (offer/answer, ICE candidates).
3. Peers negotiate a WebRTC connection and consult STUN/TURN servers for NAT traversal.
4. Media flows P2P where possible; TURN relays media when direct P2P is blocked (e.g., symmetric NATs).
5. Optional server-side workflows handle recording uploads to S3 and session persistence.

```
[Mobile Client A] <----Socket.IO----> [Signalling Server] <----Socket.IO----> [Mobile Client B]
      |                                          |
      +---- WebRTC (P2P) ----[STUN/TURN]---------+
```

---

## Getting Started

Follow these steps to run **VeloCall** locally for development.

### Prerequisites

* Node.js v18+ (recommended)
* npm or yarn
* Expo CLI (`npm i -g expo-cli`) for managed workflow
* Optional: Docker (handy for running coturn locally)

### Local Setup (Backend)

```bash
# clone repository
git clone https://github.com/<your-org>/velocall.git
cd velocall/backend

# install deps
npm install

# copy env example and edit
cp .env.example .env
# edit .env to configure ports, STUN/TURN, AWS keys, etc.

# run the backend in dev mode
npm run dev
```

The backend exposes the Socket.IO signalling endpoints (e.g. `/socket.io`) and optional REST endpoints for token generation and recordings.

### Local Setup (Mobile Client)

```bash
cd ../frontend
npm install
cp .env.example .env

# start Expo dev server
npx expo start
```

Open on a real device using **Expo Go** (recommended) or run on a simulator. Use two physical devices (or device + emulator) on the same LAN to test P2P and ICE behavior.

---

## Configuration

Place runtime configuration into root `.env` files for backend and frontend. Keep secrets out of source control.

### Environment variables (`.env.example`)

```env
# Backend
PORT=4000
SIGNALING_SECRET=your_signaling_secret
STUN_SERVERS=["stun:stun.l.google.com:19302"]
TURN_SERVERS=[{"url":"turn:turn.example.com:3478","username":"user","credential":"pass"}]
AWS_S3_BUCKET=velocall-recordings
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx

# Frontend
REACT_APP_SIGNALING_URL=http://<backend-host>:4000
REACT_APP_S3_UPLOAD_ENDPOINT=http://<backend-host>:4000/api/upload

# Optional additional flags
LOG_LEVEL=info
ENABLE_RECORDINGS=true
```

> **Security note:** When using TURN in production, provision credentials dynamically or use short-lived credentials (e.g., time-limited HMAC) rather than embedding static user\:pass in the client.

---

## STUN / TURN & Deployment Notes

* **TURN is essential** for mobile networks and for users behind symmetric NATs. Public STUN alone is not sufficient in many mobile scenarios.
* For production, run a TURN server (e.g., `coturn`) on a machine with a public IP and open UDP/TCP ports (default 3478) and TLS ports if using TURN over TLS.
* Rotate TURN credentials regularly or use an HMAC-based credential provisioning scheme for security.
* If using AWS S3 for recordings, configure CORS, lifecycle rules, server-side encryption, and IAM policies that grant the minimum required permissions.

**Docker / example coturn (local dev)**

```yaml
# docker-compose.yml (example)
version: '3.8'
services:
  coturn:
    image: instrumentisto/coturn
    restart: unless-stopped
    ports:
      - "3478:3478"
      - "3478:3478/udp"
    volumes:
      - ./coturn/turnserver.conf:/etc/turnserver.conf:ro
    command: ["turnserver", "-c", "/etc/turnserver.conf"]
```

Minimal `turnserver.conf` (example):

```
listening-port=3478
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=<YOUR_STATIC_SECRET>
realm=velocall
no-loopback-peers
no-multicast-peers

# logging, limits, etc.
```

---

## Usage

1. Start backend and Expo dev server.
2. Open the app on two devices and join the same room.
3. The signalling server will exchange SDP/ICE and peers should connect P2P.
4. Use in-app controls to mute/unmute, switch camera, or end the call.

---

## Troubleshooting

**WebRTC native module not found (mobile)**

* Ensure native WebRTC bindings are installed and linked. For managed Expo apps, either use a custom dev client with the native modules included or follow `expo-dev-client` instructions.

**No media / black screen**

* Verify camera & microphone permissions.
* Check ICE candidates in logs and ensure STUN/TURN entries are correct.
* Test with a public TURN server to confirm NAT traversal.

**Calls work on Wi‑Fi but fail on mobile data**

* Likely missing TURN relay. Ensure a public TURN server is available and reachable.

---

## Testing

* **Unit tests** (where present):

```bash
npm run test
```

* **End-to-end (manual):**

  * Test with two physical devices on separate networks (Wi‑Fi and cellular) to validate TURN fallback, ICE restarts, and reconnection behavior.

---

## Contributing

Thanks for your interest in contributing! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit using conventional commits: `git commit -m "feat: add awesome"`
4. Open a pull request and describe your changes clearly

Please keep PRs focused and small. Add tests where appropriate and follow TypeScript and code style guidelines used in the repo.

---

## License

MIT © 2025 Sankha Subhra Das

---

## Contact / Acknowledgements

Built by **Sankha Subhra Das** — [sankhasubhradas1@gmail.com](mailto:sankhasubhradas1@gmail.com)

Special thanks to the WebRTC community and the maintainers of libraries that enable cross-platform real-time media.

---

*This README is intended as a production-ready, developer-friendly starting point. Customize the configuration, deployment notes, and examples to match your infrastructure and CI/CD setup.*
