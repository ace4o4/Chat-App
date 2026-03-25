import express from 'express';
import jwt from 'jsonwebtoken';
import { store } from '../store/memoryStore';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_minimalist_comm_app';

// Auth middleware
const auth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.userId = decoded.userId;
        req.userTag = decoded.userTag;
        next();
    } catch { res.status(401).json({ error: 'Invalid token' }); }
};

// Send friend request
router.post('/request', auth, async (req: any, res) => {
    const { tag } = req.body;
    if (!tag || !tag.includes('#')) return res.status(400).json({ error: 'Use Username#1234 format' });

    const [username, discriminator] = tag.split('#');
    const target = store.findUserByTag(username, discriminator);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });

    const result = store.addFriendRequest(req.userId, target.id);
    if ('error' in result) return res.status(409).json(result);
    res.json({ message: 'Friend request sent' });
});

// Accept friend request
router.post('/accept', auth, async (req: any, res) => {
    const { fromUserId } = req.body;
    const ok = store.acceptFriendRequest(fromUserId, req.userId);
    if (!ok) return res.status(404).json({ error: 'No pending request' });
    res.json({ message: 'Accepted' });
});

// Reject friend request
router.post('/reject', auth, async (req: any, res) => {
    const { fromUserId } = req.body;
    store.rejectFriendRequest(fromUserId, req.userId);
    res.json({ message: 'Rejected' });
});

// List accepted friends
router.get('/list', auth, async (req: any, res) => {
    const friends = store.getAcceptedFriends(req.userId);
    res.json({ friends: friends.map(f => ({ id: f.id, username: f.username, discriminator: f.discriminator })) });
});

// List pending requests
router.get('/pending', auth, async (req: any, res) => {
    const pending = store.getPendingRequests(req.userId);
    res.json({ pending: pending.map(p => ({ id: p.id, username: p.username, discriminator: p.discriminator })) });
});

export default router;
