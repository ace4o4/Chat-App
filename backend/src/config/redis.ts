import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

// Create client but don't crash if it fails
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 2000,   // Fail fast: 2s timeout
        reconnectStrategy: false // Do NOT retry — if Redis is down, skip it
    }
});

let isRedisAvailable = false;

redisClient.on('error', () => {
    // Silently mark as unavailable, don't spam logs
    isRedisAvailable = false;
});

redisClient.on('connect', () => {
    isRedisAvailable = true;
});

export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('✅ Connected to Redis.');
    } catch (e) {
        console.warn('⚠️  Redis not available. Running without presence cache (dev mode).');
    }
};

// Wrapper object to safely handle commands if Redis is down
export const safeRedis = {
    set: async (key: string, value: string) => {
        if (isRedisAvailable) await redisClient.set(key, value);
    },
    sAdd: async (key: string, value: string) => {
        if (isRedisAvailable) await redisClient.sAdd(key, value);
    },
    sRem: async (key: string, value: string) => {
         if (isRedisAvailable) await redisClient.sRem(key, value);
    },
    del: async (key: string) => {
         if (isRedisAvailable) await redisClient.del(key);
    }
};

export default redisClient;
