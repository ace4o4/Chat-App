import { Server, Socket } from 'socket.io';
import { safeRedis } from '../config/redis';

// In-memory presence map (works without Redis)
const onlineUsers = new Map<string, string>(); // userTag -> socketId

export const setupSocketIO = (io: Server) => {
  io.on('connection', async (socket: Socket) => {
    const userTag = socket.handshake.query.userTag as string;
    
    if (userTag) {
       console.log(`✅ ${userTag} connected (${socket.id})`);
       onlineUsers.set(userTag, socket.id);
       await safeRedis.set(`presence:${userTag}`, socket.id);
       // Broadcast presence to all
       io.emit('presence-update', { userTag, status: 'online' });
    }

    // --- Room Management --- //
    socket.on('join-room', async (roomCode: string) => {
      socket.join(roomCode);
      await safeRedis.sAdd(`room:${roomCode}`, socket.id);
      console.log(`${userTag} joined room ${roomCode}`);
    });

    socket.on('webrtc-ready', (roomCode: string) => {
      socket.to(roomCode).emit('user-connected', { socketId: socket.id, userTag });
    });

    socket.on('get-room-participants', (roomCode: string, callback: Function) => {
        const room = io.sockets.adapter.rooms.get(roomCode);
        if (!room) return callback([]);

        const participants = Array.from(room).map(sId => {
            let tag = 'Unknown';
            for (const [k, v] of onlineUsers.entries()) {
                if (v === sId) { tag = k; break; }
            }
            return { socketId: sId, userTag: tag, isMuted: false };
        });
        callback(participants);
    });

    socket.on('leave-room', async (roomCode: string) => {
       socket.leave(roomCode);
       await safeRedis.sRem(`room:${roomCode}`, socket.id);
       socket.to(roomCode).emit('user-disconnected', { socketId: socket.id, userTag });
    });

    // --- WebRTC Signaling --- //
    socket.on('offer', (data: any) => {
      io.to(data.target).emit('offer', data);
    });

    socket.on('answer', (data: any) => {
      io.to(data.target).emit('answer', data);
    });

    socket.on('ice-candidate', (data: any) => {
      io.to(data.target).emit('ice-candidate', data);
    });

    socket.on('mute-status', (data: { roomCode: string, isMuted: boolean }) => {
        socket.to(data.roomCode).emit('mute-status', { senderId: socket.id, isMuted: data.isMuted });
    });

    // --- Direct Messages --- //
    socket.on('dm-send', (data: { targetTag: string, message: string }) => {
       if (Buffer.byteLength(data.message, 'utf8') > 1024) {
          socket.emit('error', 'Message exceeds 1KB limit');
          return;
       }
       const targetSocketId = onlineUsers.get(data.targetTag);
       if (targetSocketId) {
           io.to(targetSocketId).emit('dm-receive', { from: userTag, message: data.message, timestamp: Date.now() });
       }
    });

    // --- Room Text Chat (<1KB) --- //
    socket.on('send-message', (data: { roomCode: string, message: string }) => {
       if (Buffer.byteLength(data.message, 'utf8') > 1024) {
          socket.emit('error', 'Message exceeds 1KB limit');
          return;
       }
       socket.to(data.roomCode).emit('new-message', { sender: userTag, message: data.message, timestamp: Date.now() });
    });

    // --- Get Online Users --- //
    socket.on('get-online', (callback: Function) => {
       callback(Array.from(onlineUsers.keys()));
    });

    socket.on('disconnect', async () => {
      if (userTag) {
        onlineUsers.delete(userTag);
        await safeRedis.del(`presence:${userTag}`);
        io.emit('presence-update', { userTag, status: 'offline' });
      }
      console.log(`❌ ${userTag || socket.id} disconnected`);
    });
  });
};
