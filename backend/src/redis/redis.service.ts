import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Redis connection retry attempt ${times}, retrying in ${delay}ms...`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('Connecting to Redis...');
    });

    this.client.on('ready', () => {
      this.logger.log(`Redis connected successfully at ${host}:${port}`);
    });

    this.client.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
      this.logger.error('Make sure Redis server is running: redis-server');
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // Queue operations
  async addToQueue(branchId: string, ticketId: string): Promise<void> {
    await this.client.rpush(`queue:${branchId}`, ticketId);
  }

  async getNextFromQueue(branchId: string): Promise<string | null> {
    return await this.client.lpop(`queue:${branchId}`);
  }

  // Currently serving operations
  async setCurrentServing(branchId: string, ticketId: string): Promise<void> {
    await this.client.set(`current-serving:${branchId}`, ticketId);
  }

  async getCurrentServing(branchId: string): Promise<string | null> {
    return await this.client.get(`current-serving:${branchId}`);
  }

  async clearCurrentServing(branchId: string): Promise<void> {
    await this.client.del(`current-serving:${branchId}`);
  }

  async getQueueLength(branchId: string): Promise<number> {
    return await this.client.llen(`queue:${branchId}`);
  }

  async getAllFromQueue(branchId: string): Promise<string[]> {
    return await this.client.lrange(`queue:${branchId}`, 0, -1);
  }

  async removeFromQueue(branchId: string, ticketId: string): Promise<void> {
    await this.client.lrem(`queue:${branchId}`, 1, ticketId);
  }
}
