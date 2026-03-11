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
  private queueKey(branchId: string, serviceId?: string | null) {
    return serviceId ? `queue:${branchId}:${serviceId}` : `queue:${branchId}`;
  }

  private currentServingKey(branchId: string, serviceId?: string | null) {
    return serviceId ? `current-serving:${branchId}:${serviceId}` : `current-serving:${branchId}`;
  }

  async addToQueue(branchId: string, ticketId: string, serviceId?: string | null): Promise<void> {
    await this.client.rpush(this.queueKey(branchId, serviceId), ticketId);
  }

  async getNextFromQueue(branchId: string, serviceId?: string | null): Promise<string | null> {
    return await this.client.lpop(this.queueKey(branchId, serviceId));
  }

  // Currently serving operations
  async setCurrentServing(branchId: string, ticketId: string, serviceId?: string | null): Promise<void> {
    await this.client.set(this.currentServingKey(branchId, serviceId), ticketId);
  }

  async getCurrentServing(branchId: string, serviceId?: string | null): Promise<string | null> {
    return await this.client.get(this.currentServingKey(branchId, serviceId));
  }

  async clearCurrentServing(branchId: string, serviceId?: string | null): Promise<void> {
    await this.client.del(this.currentServingKey(branchId, serviceId));
  }

  async getQueueLength(branchId: string, serviceId?: string | null): Promise<number> {
    return await this.client.llen(this.queueKey(branchId, serviceId));
  }

  async getAllFromQueue(branchId: string, serviceId?: string | null): Promise<string[]> {
    return await this.client.lrange(this.queueKey(branchId, serviceId), 0, -1);
  }

  async removeFromQueue(branchId: string, ticketId: string, serviceId?: string | null): Promise<void> {
    await this.client.lrem(this.queueKey(branchId, serviceId), 1, ticketId);
  }
}
