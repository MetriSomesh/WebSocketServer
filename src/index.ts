import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

interface User {
  id: string;
  socket: WebSocket;
  preferences: any;
}

interface Room {
  id: string;
  users: User[];
}

let matchmakingQueue: User[] = [];
let rooms: Map<string, Room> = new Map();

const wsPort = process.env.PORT || 8080; // Use the PORT variable or default to 8080
const ws = new WebSocketServer({ port: parseInt(wsPort as string) });

ws.on("connection", (socket) => {
  let currentUser: User | null = null;

  socket.on("message", (message) => {
    const parsedMessage = JSON.parse(message.toString());

    if (parsedMessage.type === "join") {
      currentUser = {
        id: parsedMessage.payload.userId,
        socket,
        preferences: parsedMessage.payload.preferences,
      };
      matchmakingQueue.push(currentUser);
      tryToMatchUsers();
    } else if (parsedMessage.type === "chat") {
      const roomId = parsedMessage.payload.roomId;
      const room = rooms.get(roomId);

      if (room) {
        room.users.forEach((user) => {
          if (user.socket !== socket) {
            user.socket.send(
              JSON.stringify({
                type: "chat",
                from: currentUser?.id,
                message: parsedMessage.payload.message,
              })
            );
          }
        });
      }
    }
  });

  socket.on("close", () => {
    if (currentUser) {
      matchmakingQueue = matchmakingQueue.filter(
        (user) => user !== currentUser
      );

      for (const [roomId, room] of rooms.entries()) {
        room.users = room.users.filter((user) => user !== currentUser);
        if (room.users.length === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

function tryToMatchUsers() {
  while (matchmakingQueue.length >= 2) {
    const user1 = matchmakingQueue.shift()!;
    const user2 = matchmakingQueue.shift()!;

    const roomId = uuidv4();
    const room: Room = {
      id: roomId,
      users: [user1, user2],
    };

    rooms.set(roomId, room);

    user1.socket.send(
      JSON.stringify({ type: "match", roomId, opponent: user2.id })
    );
    user2.socket.send(
      JSON.stringify({ type: "match", roomId, opponent: user1.id })
    );
  }
}

console.log(`WebSocket server running on ws://localhost:${wsPort}`);
