// server/index.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 5000;
const app = express();

// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

// Health check endpoint
app.get("/health", (req, res) => res.send("OK"));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server at /ws
const wss = new WebSocket.Server({ server, path: "/ws" });

// Map to store rooms and their clients
const rooms = new Map();

// Broadcast helper
function broadcastInRoom(roomName, data, exceptSocket = null) {
  const set = rooms.get(roomName);
  if (!set) return;
  for (const client of set) {
    if (client !== exceptSocket && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  }
}

// Handle WebSocket connections
wss.on("connection", (ws, req) => {
  ws.id = uuidv4();
  ws.room = null;

  console.log(`Client connected: ${ws.id} from ${req.socket.remoteAddress}`);

  ws.on("message", (msgRaw) => {
    try {
      const msg = JSON.parse(msgRaw);

      if (!msg.type) {
        throw new Error("Message missing 'type'");
      }

      if (msg.type === "join") {
        const room = msg.room;
        if (!room) throw new Error("Join message missing room");

        ws.room = room;
        if (!rooms.has(room)) {
          rooms.set(room, new Set());
        }
        rooms.get(room).add(ws);

        const others = Array.from(rooms.get(room))
          .filter((client) => client !== ws)
          .map((client) => client.id);

        ws.send(JSON.stringify({ type: "joined", id: ws.id, others }));
        broadcastInRoom(room, { type: "new-peer", id: ws.id }, ws);

      } else if (msg.type === "signal") {
        const { room, to, from, payload } = msg;
        if (!room || !to || !from || !payload) throw new Error("Signal message missing fields");

        const clients = rooms.get(room);
        if (!clients) return;

        for (const client of clients) {
          if (client.id === to && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: "signal",
              from,
              payload
            }));
          }
        }

      } else if (msg.type === "leave") {
        const room = msg.room;
        if (!room) throw new Error("Leave message missing room");
        if (rooms.has(room)) {
          rooms.get(room).delete(ws);
          broadcastInRoom(room, { type: "peer-left", id: ws.id }, ws);
        }
        ws.room = null;

      } else {
        console.warn("Unknown message type:", msg.type);
      }

    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(JSON.stringify({ type: "error", message: error.message }));
    }
  });

  ws.on("close", () => {
    const room = ws.room;
    if (room && rooms.has(room)) {
      rooms.get(room).delete(ws);
      broadcastInRoom(room, { type: "peer-left", id: ws.id }, ws);
      if (rooms.get(room).size === 0) {
        rooms.delete(room);
      }
    }
    console.log(`Client disconnected: ${ws.id}`);
  });

  // Optional: ping to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
  console.log(`Web client available at http://0.0.0.0:${PORT}/client.html`);
});
