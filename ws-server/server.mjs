import { createServer } from "http";
import { Server } from "socket.io";

const PORT = parseInt(process.env.PORT || "3100", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// In-memory room tracking: groupId -> Map<socketId, userData>
const rooms = new Map();

// In-memory code state: groupId -> { html, css, js }
const roomCodeState = new Map();

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
    roomCodeState.delete(groupId);
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

function summarizeCodeState(codeState) {
  return {
    htmlLen: typeof codeState?.html === "string" ? codeState.html.length : 0,
    cssLen: typeof codeState?.css === "string" ? codeState.css.length : 0,
    jsLen: typeof codeState?.js === "string" ? codeState.js.length : 0,
  };
}

function summarizeEditorPayload(data) {
  const content = data?.changes?.[0];
  return {
    editorType: data?.editorType,
    version: data?.version,
    hasContent: typeof content === "string",
    contentLen: typeof content === "string" ? content.length : 0,
  };
}

io.on("connection", (socket) => {
  const { userId, userEmail, userName, userImage, groupId } = socket.handshake.auth;

  console.log(`[connect] socket=${socket.id} userId=${userId} user=${userEmail} group=${groupId}`);

  // Handle join-game
  socket.on("join-game", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;

    socket.join(roomId);

    const userData = {
      clientId: data.clientId || socket.id,
      userId: data.userId || userId,
      userEmail: data.userEmail || userEmail,
      userName: data.userName || userName,
      userImage: data.userImage || userImage,
      activeTab: null,
      isTyping: false,
    };
    addUserToRoom(roomId, socket.id, userData);

    // Notify others in the room
    socket.to(roomId).emit("user-joined", userData);

    // Send current users to the joining socket
    const currentUsers = Array.from(getRoomUsers(roomId).values());
    socket.emit("current-users", { users: currentUsers });

    // Send current code state to the joining socket
    const codeState = roomCodeState.get(roomId);
    if (codeState) {
      socket.emit("code-sync", codeState);
      console.log(
        `[code-sync:emit] room=${roomId} target=${socket.id} ${JSON.stringify(summarizeCodeState(codeState))}`
      );
    }

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
    console.log(
      `[editor-cursor:recv] room=${roomId} from=${socket.id} editorType=${data.editorType} selection=${JSON.stringify(data.selection)}`
    );
    socket.to(roomId).emit("editor-cursor", data);
  });

  // Handle editor changes — store and forward to room
  socket.on("editor-change", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;

    // Update stored code state
    if (!roomCodeState.has(roomId)) {
      roomCodeState.set(roomId, { html: "", css: "", js: "" });
      console.log(`[room-code-state:init] room=${roomId}`);
    }
    const codeState = roomCodeState.get(roomId);
    const content = data.changes?.[0];
    if (typeof content === "string") {
      codeState[data.editorType] = content;
      console.log(
        `[editor-change:store] room=${roomId} from=${socket.id} ${JSON.stringify(summarizeEditorPayload(data))} state=${JSON.stringify(summarizeCodeState(codeState))}`
      );
    } else {
      console.log(
        `[editor-change:skip] room=${roomId} from=${socket.id} reason=changes[0]-not-string payload=${JSON.stringify(summarizeEditorPayload(data))}`
      );
    }

    const recipients = Math.max((getRoomUsers(roomId).size || 1) - 1, 0);
    console.log(
      `[editor-change:emit] room=${roomId} from=${socket.id} recipients=${recipients} ${JSON.stringify(summarizeEditorPayload(data))}`
    );
    socket.to(roomId).emit("editor-change", data);
  });

  // Handle tab focus — store and broadcast
  socket.on("tab-focus", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      const userData = room.get(socket.id);
      userData.activeTab = data.editorType;
      userData.isTyping = false;
      room.set(socket.id, userData);

      socket.to(roomId).emit("tab-focus", {
        groupId: roomId,
        clientId: userData.clientId,
        userId: userData.userId,
        userName: userData.userName,
        userImage: userData.userImage,
        editorType: data.editorType,
        ts: Date.now(),
      });
      console.log(`[tab-focus] room=${roomId} from=${socket.id} editorType=${data.editorType}`);
    }
  });

  // Handle typing status — broadcast to room
  socket.on("typing-status", (data) => {
    const roomId = data.groupId || groupId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      const userData = room.get(socket.id);
      userData.isTyping = data.isTyping;
      room.set(socket.id, userData);

      socket.to(roomId).emit("typing-status", {
        groupId: roomId,
        clientId: userData.clientId,
        userId: userData.userId,
        userName: userData.userName,
        editorType: data.editorType,
        isTyping: data.isTyping,
        ts: Date.now(),
      });
      console.log(`[typing-status] room=${roomId} from=${socket.id} editorType=${data.editorType} isTyping=${Boolean(data.isTyping)}`);
    }
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
