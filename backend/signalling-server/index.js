// server/index.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Optional Twilio SDK (only required when using Twilio)
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    console.warn('Twilio SDK not available or failed to initialize. Install "twilio" if you want Twilio support.');
  }
}

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const app = express();

// ---------- Basic middleware ----------
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Allow origins if provided, otherwise allow all for dev
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : null;

app.use(cors({
  origin: allowedOrigins || true,
}));

app.use(morgan(process.env.LOG_FORMAT || 'dev'));

// Rate limit /turn endpoint
const turnLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: parseInt(process.env.TURN_RATE_LIMIT || '60', 10), // requests per IP per window
  message: { error: 'Too many requests to /turn, please try again later.' },
});

// Serve static web client (public directory)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Health check ----------
app.get('/health', (req, res) => res.send('OK'));

// ---------- Utility: Check env and configuration ----------
function checkConfig() {
  // No hard-fail for every option; only fail if none of the turn options present
  const hasStaticTurn = !!(process.env.TURN_HOST && process.env.TURN_USER && process.env.TURN_PASS);
  const hasSharedSecret = !!process.env.TURN_SHARED_SECRET;
  const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && twilioClient);
  if (!hasStaticTurn && !hasSharedSecret && !hasTwilio) {
    console.warn('Warning: No TURN configuration found. Server will return STUN-only ICE if /turn is requested.');
  }
}
checkConfig();

// Optional API key protection for /turn
const TURN_API_KEY = process.env.TURN_API_KEY || null;
function requireTurnApiKey(req, res, next) {
  if (!TURN_API_KEY) return next();
  const key = req.header('x-api-key') || req.query.key || req.header('authorization');
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  // allow "Bearer <key>" form
  const cleanKey = key.startsWith('Bearer ') ? key.split(' ')[1] : key;
  if (cleanKey !== TURN_API_KEY) return res.status(403).json({ error: 'Invalid API key' });
  return next();
}

// ---------- Helper: Generate coturn long-term credential ----------
function generateCoturnCredential(sharedSecret, ttlSeconds = 3600, userId = 'anonymous') {
  // expiry as unix timestamp
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${userId}`;
  const hmac = crypto.createHmac('sha1', sharedSecret);
  hmac.update(username);
  const password = hmac.digest('base64');
  return { username, password, ttl: ttlSeconds, expiry };
}

// ---------- /turn endpoint ----------
app.get('/turn', requireTurnApiKey, turnLimiter, async (req, res) => {
  try {
    const clientUserId = req.query.userId || req.ip || 'anonymous';
    // 1) Prefer Twilio if available
    if (twilioClient) {
      try {
        const token = await twilioClient.tokens.create();
        // token.iceServers should be an array like: [{ urls: [...], username, credential }, ...]
        // Return exactly the shape browsers expect for RTCPeerConnection config
        return res.json({ iceServers: token.iceServers });
      } catch (err) {
        console.error('Twilio token fetch failed:', err && err.message ? err.message : err);
        // proceed to try other sources
      }
    }

    // 2) Static TURN from env
    const TURN_HOST = process.env.TURN_HOST || null;
    const TURN_USER = process.env.TURN_USER || null;
    const TURN_PASS = process.env.TURN_PASS || null;

    if (TURN_HOST && TURN_USER && TURN_PASS) {
      const urls = [
        `turn:${TURN_HOST}:3478?transport=udp`,
        `turn:${TURN_HOST}:3478?transport=tcp`
      ];
      if (process.env.TURN_TLS === 'true' || process.env.TURN_TLS === '1') {
        urls.push(`turns:${TURN_HOST}:5349`);
      }
      return res.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls, username: TURN_USER, credential: TURN_PASS },
        ],
      });
    }

    // 3) Coturn long-term credentials
    if (process.env.TURN_SHARED_SECRET) {
      const ttl = parseInt(process.env.TURN_TTL_SECS || '3600', 10);
      const { username, password } = generateCoturnCredential(process.env.TURN_SHARED_SECRET, ttl, clientUserId);
      const host = process.env.TURN_HOST || process.env.TURN_EXTERNAL_IP || req.hostname || 'TURN_HOST_NOT_SET';
      const port = process.env.TURN_PORT || 3478;
      const urls = [
        `turn:${host}:${port}?transport=udp`,
        `turn:${host}:${port}?transport=tcp`,
      ];
      if (process.env.TURN_TLS === 'true' || process.env.TURN_TLS === '1') {
        const tlsPort = process.env.TURN_TLS_PORT || 5349;
        urls.push(`turns:${host}:${tlsPort}`);
      }

      return res.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls, username, credential: password }
        ],
        ttl
      });
    }

    // 4) Fallback: STUN-only
    return res.json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
  } catch (error) {
    console.error('Error in /turn:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Create HTTP server ----------
const server = http.createServer(app);

// ---------- WebSocket server / signaling ----------
const wss = new WebSocket.Server({ server, path: '/ws' });

// Map<roomName, Set<ws>>
const rooms = new Map();

function broadcastInRoom(roomName, data, exceptSocket = null) {
  const set = rooms.get(roomName);
  if (!set) return;
  const payload = JSON.stringify(data);
  for (const client of set) {
    if (client !== exceptSocket && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws, req) => {
  ws.id = uuidv4();
  ws.room = null;

  console.log(`Client connected: ${ws.id} from ${req.socket.remoteAddress}`);

  ws.on('message', (msgRaw) => {
    try {
      const msg = JSON.parse(msgRaw);

      if (!msg.type) throw new Error("Message missing 'type'");

      if (msg.type === 'join') {
        const room = msg.room;
        if (!room) throw new Error('Join message missing room');

        ws.room = room;
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);

        const others = Array.from(rooms.get(room))
          .filter((client) => client !== ws)
          .map((client) => client.id);

        ws.send(JSON.stringify({ type: 'joined', id: ws.id, others }));
        broadcastInRoom(room, { type: 'new-peer', id: ws.id }, ws);
      } else if (msg.type === 'signal') {
        const { room, to, from, payload } = msg;
        if (!room || !to || !from || !payload) throw new Error('Signal message missing fields');

        const clients = rooms.get(room);
        if (!clients) return;
        for (const client of clients) {
          if (client.id === to && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'signal', from, payload }));
          }
        }
      } else if (msg.type === 'leave') {
        const room = msg.room;
        if (!room) throw new Error('Leave message missing room');

        if (rooms.has(room)) {
          rooms.get(room).delete(ws);
          broadcastInRoom(room, { type: 'peer-left', id: ws.id }, ws);
          if (rooms.get(room).size === 0) rooms.delete(room);
        }
        ws.room = null;
      } else {
        console.warn('Unknown message type:', msg.type);
      }
    } catch (error) {
      console.error('Error processing message:', error.message || error);
      try { ws.send(JSON.stringify({ type: 'error', message: error.message })); } catch (e) {}
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (room && rooms.has(room)) {
      rooms.get(room).delete(ws);
      broadcastInRoom(room, { type: 'peer-left', id: ws.id }, ws);
      if (rooms.get(room).size === 0) rooms.delete(room);
    }
    console.log(`Client disconnected: ${ws.id}`);
  });

  // ping keepalive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
    else clearInterval(pingInterval);
  }, 30000);
});

// ---------- Graceful shutdown ----------
let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Shutting down server gracefully...');
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed.');
    // Close all ws clients
    wss.clients.forEach((client) => {
      try { client.close(); } catch (e) {}
    });
    process.exit(0);
  });
  // Force exit if not closed in 10s
  setTimeout(() => {
    console.warn('Forcing shutdown.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ---------- Start server ----------
server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  console.log(`Web client available at http://${HOST}:${PORT}/client.html`);
});
