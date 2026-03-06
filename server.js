const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, "public")));

// Store rooms and their participants
const rooms = new Map();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/room/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room-complete.html"));
});

app.get("/create-room", (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  res.json({ roomId });
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Join a room
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    room.set(socket.id, { userName, socketId: socket.id });

    // Send list of existing users to the new joiner
    const existingUsers = Array.from(room.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ socketId: id, userName: data.userName }));

    socket.emit("existing-users", existingUsers);

    // Notify others that a new user joined
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userName,
    });

    console.log(`👤 ${userName} joined room ${roomId}`);
  });

  // WebRTC Signaling: Offer
  socket.on("offer", ({ to, offer, from, userName }) => {
    io.to(to).emit("offer", { from, offer, userName });
  });

  // WebRTC Signaling: Answer
  socket.on("answer", ({ to, answer, from }) => {
    io.to(to).emit("answer", { from, answer });
  });

  // WebRTC Signaling: ICE Candidate
  socket.on("ice-candidate", ({ to, candidate, from }) => {
    io.to(to).emit("ice-candidate", { from, candidate });
  });

  // Screen share started
  socket.on("screen-share-started", ({ roomId, userName }) => {
    socket.to(roomId).emit("screen-share-started", { socketId: socket.id, userName });
  });

  // Screen share stopped
  socket.on("screen-share-stopped", ({ roomId }) => {
    socket.to(roomId).emit("screen-share-stopped", { socketId: socket.id });
  });

  // YouTube sync events
  socket.on("youtube-url", ({ roomId, url }) => {
    socket.to(roomId).emit("youtube-url", { url, from: socket.userName });
  });

  socket.on("youtube-play", ({ roomId, time }) => {
    socket.to(roomId).emit("youtube-play", { time });
  });

  socket.on("youtube-pause", ({ roomId, time }) => {
    socket.to(roomId).emit("youtube-pause", { time });
  });

  socket.on("youtube-seek", ({ roomId, time }) => {
    socket.to(roomId).emit("youtube-seek", { time });
  });

  // Chat message
  socket.on("chat-message", ({ roomId, message, userName }) => {
    io.to(roomId).emit("chat-message", {
      message,
      userName,
      time: new Date().toLocaleTimeString(),
      id: socket.id,
    });
  });

  // Raise hand
  socket.on("raise-hand", ({ roomId, userName }) => {
    socket.to(roomId).emit("raise-hand", { socketId: socket.id, userName });
  });

  // Toggle media state (for UI sync)
  socket.on("media-state", ({ roomId, video, audio }) => {
    socket.to(roomId).emit("media-state", {
      socketId: socket.id,
      video,
      audio,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const { roomId, userName } = socket;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }
    if (roomId) {
      socket.to(roomId).emit("user-left", {
        socketId: socket.id,
        userName,
      });
    }
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});