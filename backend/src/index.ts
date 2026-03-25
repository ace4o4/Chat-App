import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectRedis } from './config/redis';

import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import friendRoutes from './routes/friends';
import { setupSocketIO } from './socket';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/friends', friendRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Minimalist Comm App Signaling Server' });
});

// Pass the IO instance to our socket module
setupSocketIO(io);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectRedis();
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`Server is running on all interfaces (port ${PORT})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
