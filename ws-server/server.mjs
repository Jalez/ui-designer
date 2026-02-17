import { createServer } from "http";
import { Server } from "socket.io";

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// In-memory room tracking: groupId -> Map<socketId, userData>
const rooms = new Map();

function getRoomUsers(groupId) {
  return rooms.get(groupId) || new Map();
}

function addUserToRoom(groupId, socketId, userData) {
  if (!rooms.has(groupId)) {
    rooms.set(groupId, new Map());
  }
  rooms.get(groupId).set(socketId, userData);
}

function removeUserFromRoom(groupId, socketId) {
  const room = rooms.get(groupId);
  if (!room) return null;
  const userData = room.get(socketId);
  room.delete(socketId);
  if (room.size === 0) {
    rooms.delete(groupId);
  }
  return userData;
}

// HTTP server with /health endpoint
const httpServer = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  const { userId, userEmail, userName, userImage, groupId } = socket.handshake.auth;

  console.log(`[connect] socket=${socket.id} userId=${userId} user=${userEmail} group=${groupId}`);

  // Handle join-game
  socket.on("join-game", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;

    socket.join(roomId);

    const userData = {
      clientId: socket.id,
      userId: data.userId || userId,
      userEmail: data.userEmail || userEmail,
      userName: data.userName || userName,
      userImage: data.userImage || userImage,
    };
    addUserToRoom(roomId, socket.id, userData);

    // Notify others in the room
    socket.to(roomId).emit("user-joined", userData);

    // Send current users to the joining socket
    const currentUsers = Array.from(getRoomUsers(roomId).values());
    socket.emit("current-users", { users: currentUsers });

    console.log(`[join-game] user=${userData.userEmail} group=${roomId} total=${currentUsers.length}`);
  });

  // Handle leave-game
  socket.on("leave-game", (data) => {
    const roomId = data?.groupId || groupId;
    if (!roomId) return;

    const userData = removeUserFromRoom(roomId, socket.id);
    socket.leave(roomId);

    if (userData) {
      socket.to(roomId).emit("user-left", {
        userId: userData.userId,
        userEmail: userData.userEmail,
        userName: userData.userName,
      });
      console.log(`[leave-game] user=${userData.userEmail} group=${roomId}`);
    }
  });

  // Handle cursor events — forward to room
  socket.on("canvas-cursor", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;
    socket.to(roomId).emit("canvas-cursor", data);
  });

  socket.on("editor-cursor", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;
    socket.to(roomId).emit("editor-cursor", data);
  });

  // Handle editor changes — forward to room
  socket.on("editor-change", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;
    socket.to(roomId).emit("editor-change", data);
  });

  // Clean up on disconnect
  socket.on("disconnect", (reason) => {
    console.log(`[disconnect] socket=${socket.id} reason=${reason}`);

    // Remove from all rooms this socket was in
    for (const [roomId, userMap] of rooms.entries()) {
      if (userMap.has(socket.id)) {
        const userData = removeUserFromRoom(roomId, socket.id);
        if (userData) {
          io.to(roomId).emit("user-left", {
            userId: userData.userId,
            userEmail: userData.userEmail,
            userName: userData.userName,
          });
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`WS server listening on port ${PORT}`);
  console.log(`CORS origin: ${CORS_ORIGIN}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
