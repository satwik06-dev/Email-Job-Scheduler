import Redis, { RedisOptions } from 'ioredis';
import { config } from './env.js';

export const redisConnectionOptions: RedisOptions = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
};

export const redisClient = new Redis(redisConnectionOptions);

redisClient.on('connect', () => {
  console.log(`[Redis] Connected to Redis at ${config.redis.host}:${config.redis.port}`);
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

export default redisClient;
