// In-memory data store — replaces PostgreSQL for instant local dev testing
// Zero dependencies, zero setup. Just run the backend and go.

import bcrypt from 'bcrypt';

interface User {
    id: number;
    username: string;
    discriminator: string;
    password_hash: string;
}

interface FriendRelation {
    user_id: number;
    friend_id: number;
    status: 'pending' | 'accepted';
}

interface Room {
    code: string;
    created_by: number;
}

class InMemoryStore {
    private users: User[] = [];
    private friends: FriendRelation[] = [];
    private rooms: Room[] = [];
    private nextId = 1;

    // ===== Users =====
    async createUser(username: string, password: string): Promise<User> {
        // Generate unique discriminator
        let discriminator: string;
        do {
            discriminator = String(Math.floor(1000 + Math.random() * 9000));
        } while (this.users.find(u => u.username === username && u.discriminator === discriminator));

        const password_hash = await bcrypt.hash(password, 10);
        const user: User = { id: this.nextId++, username, discriminator, password_hash };
        this.users.push(user);
        return user;
    }

    findUserByUsername(username: string): User | undefined {
        return this.users.find(u => u.username === username);
    }

    findUsersByUsername(username: string): User[] {
        return this.users.filter(u => u.username === username);
    }

    findUserByTag(username: string, discriminator: string): User | undefined {
        return this.users.find(u => u.username === username && u.discriminator === discriminator);
    }

    findUserById(id: number): User | undefined {
        return this.users.find(u => u.id === id);
    }

    async validatePassword(user: User, password: string): Promise<boolean> {
        return bcrypt.compare(password, user.password_hash);
    }

    // ===== Friends =====
    addFriendRequest(userId: number, friendId: number) {
        // Check for existing relation
        const existing = this.friends.find(f =>
            (f.user_id === userId && f.friend_id === friendId) ||
            (f.user_id === friendId && f.friend_id === userId)
        );
        if (existing) return { error: `Already ${existing.status}` };

        this.friends.push({ user_id: userId, friend_id: friendId, status: 'pending' });
        return { ok: true };
    }

    acceptFriendRequest(fromUserId: number, toUserId: number): boolean {
        const req = this.friends.find(f => f.user_id === fromUserId && f.friend_id === toUserId && f.status === 'pending');
        if (!req) return false;
        req.status = 'accepted';
        return true;
    }

    rejectFriendRequest(fromUserId: number, toUserId: number) {
        this.friends = this.friends.filter(f => !(f.user_id === fromUserId && f.friend_id === toUserId && f.status === 'pending'));
    }

    getAcceptedFriends(userId: number): User[] {
        const friendIds = this.friends
            .filter(f => f.status === 'accepted' && (f.user_id === userId || f.friend_id === userId))
            .map(f => f.user_id === userId ? f.friend_id : f.user_id);
        return friendIds.map(id => this.findUserById(id)!).filter(Boolean);
    }

    getPendingRequests(userId: number): User[] {
        const fromIds = this.friends
            .filter(f => f.friend_id === userId && f.status === 'pending')
            .map(f => f.user_id);
        return fromIds.map(id => this.findUserById(id)!).filter(Boolean);
    }

    // ===== Rooms =====
    createRoom(createdBy: number): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code: string;
        do {
            code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        } while (this.rooms.find(r => r.code === code));
        this.rooms.push({ code, created_by: createdBy });
        return code;
    }
}

// Singleton
export const store = new InMemoryStore();
