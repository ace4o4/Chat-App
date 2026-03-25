import express from 'express';
import jwt from 'jsonwebtoken';
import { store } from '../store/memoryStore';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_minimalist_comm_app';

const auth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.userId = decoded.userId;
        next();
    } catch { res.status(401).json({ error: 'Invalid token' }); }
};

// Create a room
router.post('/create', auth, async (req: any, res) => {
    const code = store.createRoom(req.userId);
    console.log(`🏠 Room created: ${code}`);
    res.json({ code });
});

export default router;
