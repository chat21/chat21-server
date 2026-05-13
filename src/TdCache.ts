import * as redis from 'redis';
import { TdCacheConfig } from './types';

export interface SetOptions {
  /** Expiry time in seconds */
  EX?: number;
  callback?: () => void;
}

export class TdCache {
  private redis_host: string;
  private redis_port: number | string;
  private redis_password: string | undefined;
  /** The underlying redis client — exposed for direct access where needed */
  client: redis.RedisClient | null = null;

  constructor(config: TdCacheConfig) {
    this.redis_host = config.host;
    this.redis_port = config.port;
    this.redis_password = config.password;
  }

  connect(callback?: (err?: Error) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = redis.createClient({
        host: this.redis_host,
        port: this.redis_port as number,
        password: this.redis_password,
      } as redis.ClientOpts);

      this.client.on('error', (err: Error) => {
        reject(err);
        if (callback) {
          callback(err);
        }
      });

      this.client.on('ready', () => {
        resolve();
        if (callback) {
          callback();
        }
      });
    });
  }

  set(key: string, value: string, options?: SetOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      const done = () => {
        if (options?.callback) {
          options.callback();
        }
        resolve();
      };

      if (options?.EX) {
        this.client.set(key, value, 'EX', options.EX, (err) => {
          if (err) return reject(err);
          done();
        });
      } else {
        this.client.set(key, value, (err) => {
          if (err) {
            console.error('Error', err);
            return reject(err);
          }
          done();
        });
      }
    });
  }

  incr(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      this.client.incr(key, (err) => {
        if (err) {
          console.error('Error on incr:', err);
          return reject(err);
        }
        resolve();
      });
    });
  }

  hset(dict_key: string, key: string, value: string, options?: SetOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      const done = () => {
        if (options?.callback) {
          options.callback();
        }
        resolve();
      };

      this.client.hset(dict_key, key, value, (err) => {
        if (err) {
          console.error('Error', err);
          return reject(err);
        }
        done();
      });
    });
  }

  hdel(dict_key: string, key: string, options?: SetOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      this.client.hdel(dict_key, key, (err) => {
        if (err) {
          console.error('Error', err);
          return reject(err);
        }
        if (options?.callback) {
          options.callback();
        }
        resolve();
      });
    });
  }

  setJSON(key: string, value: unknown, options?: SetOptions): Promise<void> {
    const _string = JSON.stringify(value);
    return this.set(key, _string, options);
  }

  get(key: string, callback?: (value: string | null) => void): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      this.client.get(key, (err, value) => {
        if (err) {
          return reject(err);
        }
        if (callback) {
          callback(value);
        }
        resolve(value);
      });
    });
  }

  hgetall(dict_key: string, callback?: (err: Error | null, value: Record<string, string> | null) => void): Promise<Record<string, string> | null> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      this.client.hgetall(dict_key, (err, value) => {
        if (err) {
          if (callback) callback(err, null);
          return reject(err);
        }
        if (callback) callback(null, value);
        resolve(value);
      });
    });
  }

  hget(dict_key: string, key: string, callback?: (err: Error | null, value: string | null) => void): Promise<string | null> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      this.client.hget(dict_key, key, (err, value) => {
        if (err) {
          if (callback) callback(err, null);
          return reject(err);
        }
        if (callback) callback(null, value);
        resolve(value);
      });
    });
  }

  async getJSON<T = unknown>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch (err) {
      console.error(`TdCache.getJSON: failed to parse JSON for key "${key}":`, (err as Error).message);
      return null;
    }
  }

  del(key: string, callback?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('Redis client not connected'));
      }
      this.client.del(key, (err) => {
        if (err) return reject(err);
        if (callback) callback();
        resolve();
      });
    });
  }
}
