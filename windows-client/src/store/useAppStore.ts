import { create } from 'zustand';

interface Message {
    from: string;
    message: string;
    timestamp: number;
}

interface Friend {
    id: number;
    username: string;
    discriminator: string;
    online?: boolean;
}

interface RoomParticipant {
    userTag: string;
    socketId: string;
    isMuted?: boolean;
}

interface AppState {
    user: { username: string; discriminator: string; token: string } | null;
    currentRoom: string | null;
    socketId: string | null;
    isMuted: boolean;
    isDeafened: boolean;
    activeTab: 'friends' | 'chat' | 'voice';
    friends: Friend[];
    pendingRequests: Friend[];
    onlineUsers: string[];
    messages: Message[];
    dmTarget: string | null;
    dmMessages: Record<string, Message[]>;
    roomParticipants: RoomParticipant[];

    setUser: (user: AppState['user']) => void;
    setRoom: (roomCode: string | null) => void;
    setSocketId: (id: string | null) => void;
    toggleMute: () => void;
    toggleDeafen: () => void;
    setActiveTab: (tab: AppState['activeTab']) => void;
    setFriends: (friends: Friend[]) => void;
    setPendingRequests: (pending: Friend[]) => void;
    setOnlineUsers: (users: string[]) => void;
    addMessage: (msg: Message) => void;
    setDmTarget: (tag: string | null) => void;
    addDm: (tag: string, msg: Message) => void;
    setRoomParticipants: (participants: RoomParticipant[]) => void;
    addRoomParticipant: (p: RoomParticipant) => void;
    removeRoomParticipant: (socketId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
    user: null,
    currentRoom: null,
    socketId: null,
    isMuted: false,
    isDeafened: false,
    activeTab: 'friends',
    friends: [],
    pendingRequests: [],
    onlineUsers: [],
    messages: [],
    dmTarget: null,
    dmMessages: {},
    roomParticipants: [],

    setUser: (user) => set({ user }),
    setRoom: (roomCode) => set({ currentRoom: roomCode }),
    setSocketId: (id) => set({ socketId: id }),
    toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
    toggleDeafen: () => set((s) => {
        const d = !s.isDeafened;
        return { isDeafened: d, isMuted: d ? true : s.isMuted };
    }),
    setActiveTab: (tab) => set({ activeTab: tab }),
    setFriends: (friends) => set({ friends }),
    setPendingRequests: (pending) => set({ pendingRequests: pending }),
    setOnlineUsers: (users) => set({ onlineUsers: users }),
    addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
    setDmTarget: (tag) => set({ dmTarget: tag }),
    addDm: (tag, msg) => set((s) => ({
        dmMessages: {
            ...s.dmMessages,
            [tag]: [...(s.dmMessages[tag] || []), msg]
        }
    })),
    setRoomParticipants: (participants) => set({ roomParticipants: participants }),
    addRoomParticipant: (p) => set((s) => ({ roomParticipants: [...s.roomParticipants.filter(x => x.socketId !== p.socketId), p] })),
    removeRoomParticipant: (socketId) => set((s) => ({ roomParticipants: s.roomParticipants.filter(x => x.socketId !== socketId) })),
}));
