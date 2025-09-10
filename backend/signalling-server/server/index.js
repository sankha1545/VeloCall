// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static client files from ../public
const PUBLIC_PATH = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_PATH));

// In-memory rooms store (dev only). Structure:
// rooms = { [roomId]: { ownerSocketId, ownerIdentity, participants: { socketId: { identity } } } }
const rooms = {};

/**
 * GET /api/ice-servers
 * Returns an array of ICE servers for clients to use.
 * If TURN env vars are configured, it will return the TURN server credentials.
 */
app.get('/api/ice-servers', (req, res) => {
  const ice = [
    { urls: ['stun:stun.l.google.com:19302'] }
  ];

  // Optional TURN support via env
  // Provide TURN_URL, TURN_USER, TURN_PASS (or leave empty to use only STUN)
  const { TURN_URL, TURN_USER, TURN_PASS } = process.env;
  if (TURN_URL && TURN_USER && TURN_PASS) {
    ice.push({
      urls: TURN_URL.split(',').map(s => s.trim()),
      username: TURN_USER,
      credential: TURN_PASS
    });
  }

  res.json({ iceServers: ice });
});

/**
 * POST /api/create-room
 * body: { roomId? }
 * returns { roomId, joinUrl }
 */
app.post('/api/create-room', (req, res) => {
  const requested = req.body && req.body.roomId;
  const roomId = requested && typeof requested === 'string' ? requested : uuidv4().slice(0, 8);
  if (!rooms[roomId]) {
    rooms[roomId] = { ownerSocketId: null, ownerIdentity: null, participants: {} };
  }
  const joinUrl = `${req.protocol}://${req.get('host')}/join.html?room=${encodeURIComponent(roomId)}`;
  return res.json({ roomId, joinUrl });
});

/**
 * POST /api/kick
 * body: { roomId, participantIdentity, ownerIdentity }
 */
app.post('/api/kick', (req, res) => {
  const { roomId, participantIdentity, ownerIdentity } = req.body || {};
  if (!roomId || !participantIdentity || !ownerIdentity) return res.status(400).send('roomId, participantIdentity and ownerIdentity required');

  const room = rooms[roomId];
  if (!room) return res.status(404).send('room not found');

  // verify owner
  if (room.ownerIdentity !== ownerIdentity) return res.status(403).send('only owner can kick');

  // find participant socketId by identity
  const entry = Object.entries(room.participants).find(([sock, info]) => info.identity === participantIdentity);
  if (!entry) return res.status(404).send('participant not found');

  const [targetSocketId] = entry;
  io.to(targetSocketId).emit('kicked', { reason: 'kicked_by_owner' });

  return res.json({ ok: true });
});

// create HTTP + socket.io server
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log('[io] connected', socket.id);

  socket.on('join-room', (payload) => {
    const { roomId, identity, wantOwner } = payload || {};
    if (!roomId || !identity) {
      console.warn('join-room missing payload', payload);
      socket.emit('error', 'roomId and identity required');
      return;
    }

    socket.join(roomId);
    rooms[roomId] = rooms[roomId] || { ownerSocketId: null, ownerIdentity: null, participants: {} };
    rooms[roomId].participants[socket.id] = { identity };

    // set owner if requested and none exists
    if (wantOwner && !rooms[roomId].ownerSocketId) {
      rooms[roomId].ownerSocketId = socket.id;
      rooms[roomId].ownerIdentity = identity;
    }

    // send existing participants to the joining socket
    const others = Object.keys(rooms[roomId].participants).filter((sid) => sid !== socket.id);
    const existing = others.map((sid) => ({ socketId: sid, identity: rooms[roomId].participants[sid].identity }));
    socket.emit('existing-participants', existing);

    // notify existing participants about the new participant
    socket.to(roomId).emit('new-participant', { socketId: socket.id, identity });

    // handle signaling relay
    socket.on('signal', (data) => {
      // data: { to: targetSocketId, signal: <SDP or candidate>, fromIdentity }
      if (!data || !data.to) return;
      io.to(data.to).emit('signal', { from: socket.id, signal: data.signal, fromIdentity: identity });
    });

    socket.on('disconnect', () => {
      // cleanup
      if (!rooms[roomId]) return;

      delete rooms[roomId].participants[socket.id];
      socket.to(roomId).emit('participant-left', { socketId: socket.id, identity });

      // if owner left, optionally promote another participant as owner
      if (rooms[roomId].ownerSocketId === socket.id) {
        const remaining = Object.keys(rooms[roomId].participants);
        rooms[roomId].ownerSocketId = remaining[0] || null;
        rooms[roomId].ownerIdentity = rooms[roomId].ownerSocketId ? rooms[roomId].participants[rooms[roomId].ownerSocketId].identity : null;
        io.in(roomId).emit('owner-changed', { ownerIdentity: rooms[roomId].ownerIdentity });
      }

      // if no participants remain, delete the room
      if (Object.keys(rooms[roomId].participants).length === 0) {
        delete rooms[roomId];
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Signalling server listening on ${PORT}`));
