import express from 'express';
import jwt from 'jsonwebtoken';
import { store } from '../store/memoryStore';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_minimalist_comm_app';

// Register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (password.length < 4) return res.status(400).json({ error: 'Password too short (min 4)' });

    try {
        const user = await store.createUser(username, password);
        const tag = `${user.username}#${user.discriminator}`;
        const token = jwt.sign({ userId: user.id, userTag: tag }, JWT_SECRET, { expiresIn: '24h' });

        console.log(`✅ Registered: ${tag}`);
        res.status(201).json({ token, username: user.username, discriminator: user.discriminator, id: user.id });
    } catch (e) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        // Find all users with this username and try each
        const users = store.findUsersByUsername(username);
        if (users.length === 0) return res.status(401).json({ error: 'User not found' });

        for (const user of users) {
            const valid = await store.validatePassword(user, password);
            if (valid) {
                const tag = `${user.username}#${user.discriminator}`;
                const token = jwt.sign({ userId: user.id, userTag: tag }, JWT_SECRET, { expiresIn: '24h' });
                console.log(`✅ Login: ${tag}`);
                return res.json({ token, username: user.username, discriminator: user.discriminator, id: user.id });
            }
        }
        res.status(401).json({ error: 'Wrong password' });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

export default router;
