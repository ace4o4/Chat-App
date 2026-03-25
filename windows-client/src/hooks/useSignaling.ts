import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';

const API = `http://${window.location.hostname}:5000`;

export const useSignaling = () => {
    const socketRef = useRef<Socket | null>(null);
    const { user, setSocketId, setOnlineUsers, addMessage, addDm } = useAppStore();

    useEffect(() => {
        if (!user) {
            // Disconnect if user logs out
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            return;
        }

        const userTag = `${user.username}#${user.discriminator}`;
        socketRef.current = io(API, {
            query: { userTag }
        });

        const s = socketRef.current;

        s.on('connect', () => {
            setSocketId(s.id || null);
            console.log('🔌 Socket connected:', s.id);
            // Get initial online list
            s.emit('get-online', (users: string[]) => {
                setOnlineUsers(users);
            });
        });

        s.on('presence-update', ({ userTag: tag, status }: { userTag: string; status: string }) => {
            const store = useAppStore.getState();
            if (status === 'online') {
                if (!store.onlineUsers.includes(tag)) {
                    setOnlineUsers([...store.onlineUsers, tag]);
                }
            } else {
                setOnlineUsers(store.onlineUsers.filter(u => u !== tag));
            }
        });

        s.on('new-message', (data: { sender: string; message: string; timestamp: number }) => {
            addMessage({ from: data.sender, message: data.message, timestamp: data.timestamp });
        });

        s.on('dm-receive', (data: { from: string; message: string; timestamp: number }) => {
            addDm(data.from, data);
        });

        s.on('user-connected', ({ userTag: tag }: { socketId: string; userTag: string }) => {
            addMessage({ from: 'System', message: `${tag} joined the room`, timestamp: Date.now() });
        });

        s.on('user-disconnected', ({ userTag: tag }: { socketId: string; userTag: string }) => {
            addMessage({ from: 'System', message: `${tag} left the room`, timestamp: Date.now() });
        });

        return () => {
            s.disconnect();
            socketRef.current = null;
        };
    }, [user?.username, user?.discriminator]);

    const joinRoom = useCallback((roomCode: string) => {
        socketRef.current?.emit('join-room', roomCode);
    }, []);

    const leaveRoom = useCallback((roomCode: string) => {
        socketRef.current?.emit('leave-room', roomCode);
    }, []);

    const sendMessage = useCallback((roomCode: string, message: string) => {
        socketRef.current?.emit('send-message', { roomCode, message });
    }, []);

    const sendDm = useCallback((targetTag: string, message: string) => {
        socketRef.current?.emit('dm-send', { targetTag, message });
    }, []);

    return { socket: socketRef.current, joinRoom, leaveRoom, sendMessage, sendDm };
};

// API helpers
export const api = {
    register: async (username: string, password: string) => {
        const res = await fetch(`${API}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return res.json();
    },
    login: async (username: string, password: string) => {
        const res = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        return res.json();
    },
    sendFriendRequest: async (token: string, tag: string) => {
        const res = await fetch(`${API}/api/friends/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tag })
        });
        return res.json();
    },
    acceptFriend: async (token: string, fromUserId: number) => {
        const res = await fetch(`${API}/api/friends/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ fromUserId })
        });
        return res.json();
    },
    getFriends: async (token: string) => {
        const res = await fetch(`${API}/api/friends/list`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },
    getPending: async (token: string) => {
        const res = await fetch(`${API}/api/friends/pending`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return res.json();
    },
    createRoom: async (token: string) => {
        const res = await fetch(`${API}/api/rooms/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        return res.json();
    }
};
